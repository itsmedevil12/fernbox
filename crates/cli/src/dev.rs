//! `fernbox dev`: a run that re-runs itself when the app folder changes.
//!
//! The daemon has no watch mode and needs none. A run is one-shot and a fresh
//! worker boots per run, so "hot reload" is a client-side loop: watch the app
//! folder, re-issue the same `Run` when a file changes, and print what came
//! back. Nothing in the trust root changes, and the sandbox gets no new way to
//! outlive itself.
//!
//! Three things make the loop usable rather than annoying:
//!
//! * **Debounce.** An editor saving one file often emits several filesystem
//!   events in a row, and a formatter writes and renames. Waiting for a quiet
//!   moment means one rebuild per save instead of four.
//! * **No overlap.** A rebuild is not started while the previous run is still
//!   going; the pending change is remembered and run once the run ends, so two
//!   builds can never write the same volume at once.
//! * **The watcher ignores what it should.** `node_modules` and dot-directories
//!   are skipped, because an `npm install` during a session would otherwise
//!   trigger a rebuild per unpacked package.
//!
//! Polling rather than inotify: there is no cross-platform crate in this tree
//! yet, and a recursive mtime scan of an app folder is cheap — an app folder is
//! the caller's own source, tens of files, not a repository checkout. Inotify's
//! wins would be invisible at that size and its platform differences would not.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
#[cfg(test)]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(test)]
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use fernbox_client::Endpoint;
use fernbox_proto::ClientRequest;

/// How often the app folder is scanned. Fast enough that a save feels instant,
/// slow enough that a large folder is not a battery drain.
const POLL: Duration = Duration::from_millis(120);

/// How long the folder must be quiet before a rebuild starts. An editor that
/// writes, chmods, and renames emits three events for one save; this collapses
/// them into one rebuild.
const DEBOUNCE: Duration = Duration::from_millis(200);

/// Directories never walked. `node_modules` is the big one — an install would
/// otherwise look like several hundred edits — and dot-directories hold editor
/// and git state rather than the app.
const SKIP: [&str; 1] = ["node_modules"];

/// What changed, in the terms a human reads in the log line.
pub struct Change {
    pub added: usize,
    pub removed: usize,
    pub modified: usize,
}

impl Change {
    pub fn is_empty(&self) -> bool {
        self.added == 0 && self.removed == 0 && self.modified == 0
    }

    pub fn summary(&self) -> String {
        let mut parts = Vec::new();
        if self.added > 0 {
            parts.push(format!("+{}", self.added));
        }
        if self.modified > 0 {
            parts.push(format!("~{}", self.modified));
        }
        if self.removed > 0 {
            parts.push(format!("-{}", self.removed));
        }
        if parts.is_empty() {
            "no change".to_string()
        } else {
            parts.join(" ")
        }
    }
}

/// One snapshot of the app folder: every file's path and mtime.
///
/// Contents are not hashed. A `touch` would then be a rebuild and an edit that
/// lands in the same millisecond as the previous one would be missed; mtime
/// plus size is what every watcher in the wild uses, and it is right far more
/// often than a timestamp alone.
pub type Snapshot = BTreeMap<PathBuf, (SystemTime, u64)>;

/// Scan the app folder. Unreadable entries are skipped rather than fatal: a file
/// that vanishes mid-walk is an edit, not a reason to stop watching.
pub fn snapshot(root: &Path) -> Snapshot {
    let mut out = BTreeMap::new();
    walk(root, root, &mut out);
    out
}

fn walk(root: &Path, dir: &Path, out: &mut Snapshot) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let name = entry.file_name();

        if meta.is_dir() {
            let name = name.to_string_lossy();
            // `node_modules` and any dot-directory are not the app's source.
            if SKIP.iter().any(|s| *s == name) || name.starts_with('.') {
                continue;
            }
            walk(root, &path, out);
        } else if meta.is_file() {
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            out.insert(relative.to_path_buf(), (modified, meta.len()));
        }
    }
}

/// What differs between two snapshots.
pub fn diff(before: &Snapshot, after: &Snapshot) -> Change {
    let mut change = Change { added: 0, removed: 0, modified: 0 };
    for (path, stamp) in after {
        match before.get(path) {
            None => change.added += 1,
            Some(previous) if previous != stamp => change.modified += 1,
            Some(_) => {}
        }
    }
    change.removed = before.keys().filter(|path| !after.contains_key(*path)).count();
    change
}

/// Watch `app_dir` and call `rebuild` after each settled change.
///
/// `rebuild` gets the change that triggered it. Its return value is ignored, so
/// the caller decides what a failed build does — the loop keeps watching either
/// way, because the fix is an edit.
///
/// The loop is one implementation with two front doors: [`watch`] for a process
/// that runs until it is killed, and [`watch_until`] for a test that needs to
/// stop it. The stopping condition is the only difference, so it is a parameter
/// rather than a copied body.
fn watch_inner<F>(app_dir: &Path, stop: impl Fn() -> bool, mut rebuild: F)
where
    F: FnMut(&Change),
{
    let mut current = snapshot(app_dir);
    let mut dirty: Option<(Snapshot, SystemTime)> = None;

    while !stop() {
        std::thread::sleep(POLL);

        let latest = snapshot(app_dir);

        // The pending snapshot is only re-stamped when it actually moves. A
        // folder that has stopped changing keeps the timestamp from the last
        // real edit, which is what lets the quiet window elapse — re-stamping on
        // every tick would restart the debounce forever and a save would never
        // fire.
        let moved = match &dirty {
            Some((pending, _)) => &latest != pending,
            None => latest != current,
        };
        if moved {
            dirty = Some((latest, SystemTime::now()));
            continue;
        }

        let Some((pending, seen)) = dirty.as_ref() else {
            continue;
        };
        if seen.elapsed().unwrap_or_default() < DEBOUNCE {
            continue;
        }

        let change = diff(&current, pending);
        current = pending.clone();
        dirty = None;

        if change.is_empty() {
            continue;
        }
        rebuild(&change);
        // An edit made *while* the build ran is not lost: the snapshot is
        // re-read here, so the next tick sees it as a fresh change.
        current = snapshot(app_dir);
    }
}

/// Watch until the process is killed.
pub fn watch<F>(app_dir: &Path, rebuild: F)
where
    F: FnMut(&Change),
{
    watch_inner(app_dir, || false, rebuild);
}

/// Watch until `stop` is set, for a caller that owns the stopping condition.
/// Used by the tests, which need the loop to end on their say-so.
#[cfg(test)]
pub fn watch_until<F>(app_dir: &Path, stop: Arc<AtomicBool>, rebuild: F)
where
    F: FnMut(&Change),
{
    watch_inner(app_dir, move || stop.load(Ordering::SeqCst), rebuild);
}

/// Run the app once, printing what came back and returning the exit code the
/// outcome means. Shared by the first build and every rebuild, so the two cannot
/// drift into reporting differently.
pub fn run_once(endpoint: &Endpoint, request: &ClientRequest) -> Result<ExitCode, String> {
    let response = fernbox_client::request(endpoint, request)?;
    Ok(crate::print_response(response))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fernbox-dev-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_new_file_reads_as_an_addition() {
        let dir = temp("add");
        std::fs::write(dir.join("main.js"), "1").unwrap();
        let before = snapshot(&dir);

        std::fs::write(dir.join("extra.js"), "2").unwrap();
        let after = snapshot(&dir);

        let change = diff(&before, &after);
        assert_eq!(change.added, 1);
        assert_eq!(change.modified, 0);
        assert_eq!(change.removed, 0);
        assert_eq!(change.summary(), "+1");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_deleted_file_reads_as_a_removal() {
        let dir = temp("rm");
        std::fs::write(dir.join("a.js"), "1").unwrap();
        std::fs::write(dir.join("b.js"), "2").unwrap();
        let before = snapshot(&dir);
        std::fs::remove_file(dir.join("b.js")).unwrap();

        let change = diff(&before, &snapshot(&dir));
        assert_eq!(change.removed, 1);
        assert_eq!(change.summary(), "-1");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_edit_reads_as_a_modification() {
        let dir = temp("mod");
        let file = dir.join("main.js");
        let mut handle = std::fs::File::create(&file).unwrap();
        handle.write_all(b"one").unwrap();
        drop(handle);
        let before = snapshot(&dir);

        // A different size is enough to be seen without relying on mtime
        // resolution, which is coarse on some filesystems.
        let mut handle = std::fs::File::create(&file).unwrap();
        handle.write_all(b"one changed").unwrap();
        drop(handle);

        let change = diff(&before, &snapshot(&dir));
        assert_eq!(change.modified, 1);
        assert_eq!(change.summary(), "~1");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn node_modules_and_dot_directories_are_not_walked() {
        let dir = temp("skip");
        std::fs::write(dir.join("main.js"), "1").unwrap();
        std::fs::create_dir_all(dir.join("node_modules/pkg")).unwrap();
        std::fs::write(dir.join("node_modules/pkg/index.js"), "x").unwrap();
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        std::fs::write(dir.join(".git/HEAD"), "ref").unwrap();

        let files = snapshot(&dir);
        assert!(files.contains_key(Path::new("main.js")));
        assert!(
            !files.keys().any(|p| p.to_string_lossy().contains("node_modules")),
            "node_modules must not be walked"
        );
        assert!(
            !files.keys().any(|p| p.to_string_lossy().contains(".git")),
            "dot-directories must not be walked"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_settled_change_fires_exactly_once() {
        let dir = temp("fire");
        std::fs::write(dir.join("main.js"), "1").unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopper = Arc::clone(&stop);
        let app = dir.clone();

        let handle = std::thread::spawn(move || {
            let mut fired = Vec::new();
            watch_until(&app, stopper, |change| fired.push(change.summary()));
            fired
        });

        std::thread::sleep(Duration::from_millis(60));
        std::fs::write(dir.join("main.js"), "2").unwrap();
        std::thread::sleep(POLL + DEBOUNCE + Duration::from_millis(200));
        stop.store(true, Ordering::SeqCst);

        let fired = handle.join().unwrap();
        assert_eq!(fired.len(), 1, "one save must be one rebuild, got {fired:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
