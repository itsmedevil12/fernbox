//! The `~/.fernbox` state directory, and the only place host disk meets
//! instance state.
//!
//! The daemon is the trust root, so it owns every read and write of host disk:
//! images, volumes, and snapshots are loaded here, marshalled into a seed as
//! file contents, and handed to the isolate. The isolate never learns a host
//! path — only the bytes that were assembled for it. Writing back goes through
//! the same boundary, one file map at a time.
//!
//! Everything on disk is a flat `{"posix/path": "utf8 contents"}` map, because
//! that is the shape the runtime's `Volume.fromJSON` takes and `toJSON`
//! returns. A volume and a snapshot are the same file; `commit` is a copy
//! between the two.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use fernbox_core::{validate_mount, validate_name, FsPolicy, InstanceSeed};

/// A file map: posix paths to utf8 contents, ordered so a given image or volume
/// serialises identically every time.
pub type FileMap = BTreeMap<String, String>;

/// The state directory: `~/.fernbox` unless something overrides it.
pub struct StateDir {
    root: PathBuf,
}

impl StateDir {
    /// Where state lives. An override is how the tests get a throwaway directory;
    /// without one it is `.fernbox` under the user's home, which `home` finds
    /// without touching the ambient environment.
    pub fn resolve(override_dir: Option<&str>) -> Result<StateDir, String> {
        let root = match override_dir {
            Some(dir) => PathBuf::from(dir),
            None => home::home_dir()
                .ok_or("cannot locate the user's home directory")?
                .join(".fernbox"),
        };
        Ok(StateDir { root })
    }

    /// The directory itself: `serve` writes `daemon.json` here, and nothing else
    /// outside this struct names it.
    pub fn root(&self) -> &Path {
        &self.root
    }

    fn images_dir(&self) -> PathBuf {
        self.root.join("images")
    }

    fn volumes_dir(&self) -> PathBuf {
        self.root.join("volumes")
    }

    fn volume_file(&self, name: &str) -> PathBuf {
        self.volumes_dir().join(format!("{name}.json"))
    }

    fn image_dir(&self, name: &str) -> PathBuf {
        self.images_dir().join(name)
    }

    /// A committed image's file map, or `None` if there is no such directory.
    /// Names are validated before they are joined into a path.
    pub fn load_image(&self, name: &str) -> Result<Option<FileMap>, String> {
        validate_name(name)?;
        let dir = self.image_dir(name);
        if !dir.is_dir() {
            return Ok(None);
        }
        Ok(Some(load_file_map(&dir)?))
    }

    /// A volume's saved file map. A volume that has never been written is an
    /// empty map, not a missing one: the mount still exists, it just holds
    /// nothing yet.
    pub fn load_volume(&self, name: &str) -> Result<FileMap, String> {
        validate_name(name)?;
        let file = self.volume_file(name);
        match std::fs::read(&file) {
            Ok(bytes) => parse_file_map(&bytes, &file),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(FileMap::new()),
            Err(err) => Err(format!("cannot read {}: {err}", file.display())),
        }
    }

    /// Serialise a volume's file map and hold it to the quota, without touching
    /// disk. Split out of [`Self::write_volume`] so a run with several volumes
    /// can be checked for size as a set before any of them is written.
    pub fn volume_json(&self, name: &str, map: &FileMap, policy: &FsPolicy) -> Result<String, String> {
        validate_name(name)?;
        let json = serde_json::to_string(map)
            .map_err(|err| format!("cannot serialise volume `{name}`: {err}"))?;
        if json.len() > policy.max_volume_bytes {
            return Err(format!(
                "volume `{name}` is {} bytes, over the {} byte limit",
                json.len(),
                policy.max_volume_bytes
            ));
        }
        Ok(json)
    }

    /// Write an already-checked volume map to disk, replacing whatever was
    /// there. Nothing is written if the map is too large: persistent state must
    /// not be quietly truncated to fit a quota.
    pub fn write_volume(&self, name: &str, json: &str) -> Result<(), String> {
        validate_name(name)?;
        let dir = self.volumes_dir();
        std::fs::create_dir_all(&dir).map_err(|err| format!("cannot create {}: {err}", dir.display()))?;
        let file = self.volume_file(name);
        std::fs::write(&file, json).map_err(|err| format!("cannot write {}: {err}", file.display()))
    }

    /// Freeze a volume into a new base image, layered over `base_json`: the
    /// volume's own writes win where both have a path, and everything else in
    /// the base — `/etc/hosts`, the rest of the image — comes through untouched.
    /// That is what makes a committed image runnable on its own, the way a
    /// committed container is.
    ///
    /// Materialised as real files under the images directory, where the next
    /// `run` picks it up ahead of any built-in of the same name.
    pub fn commit_volume(
        &self,
        volume: &str,
        image: &str,
        base_json: &str,
        policy: &FsPolicy,
    ) -> Result<(), String> {
        validate_name(volume)?;
        validate_name(image)?;

        let map = merge_file_maps(&parse_image_map(base_json, image)?, &self.load_volume(volume)?);
        // The keys came off disk as posix paths without `..`, but a check here
        // is cheap and this is the one place that turns them back into real
        // files.
        for path in map.keys() {
            if !path.starts_with('/') || path.split('/').any(|part| part == "..") {
                return Err(format!("the committed state holds an unsafe path: {path}"));
            }
        }

        let root = self.image_dir(image);
        std::fs::create_dir_all(&root)
            .map_err(|err| format!("cannot create {}: {err}", root.display()))?;

        // An image is what a seed is built from, so it is capped as one rather
        // than at the smaller volume quota.
        let mut total = 0usize;
        for (path, contents) in &map {
            total += contents.len();
            if total > policy.max_seed_bytes {
                return Err(format!(
                    "the committed image is over the {} byte limit",
                    policy.max_seed_bytes
                ));
            }
            let target = root.join(path.trim_start_matches('/'));
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|err| format!("cannot create {}: {err}", parent.display()))?;
            }
            std::fs::write(&target, contents)
                .map_err(|err| format!("cannot write {}: {err}", target.display()))?;
        }
        Ok(())
    }

    /// Committed image names, validated before any path is joined.
    pub fn list_images(&self) -> Result<Vec<String>, String> {
        list_dirs(&self.images_dir())
    }

    /// Volume names, from the `name.json` files that hold them.
    pub fn list_volumes(&self) -> Result<Vec<String>, String> {
        let dir = self.volumes_dir();
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(format!("cannot read {}: {err}", dir.display())),
        };

        let mut names = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|err| format!("cannot read {}: {err}", dir.display()))?;
            if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            let Some(stripped) = name.strip_suffix(".json") else { continue };
            if validate_name(stripped).is_err() {
                continue;
            }
            names.push(stripped.to_string());
        }
        names.sort();
        Ok(names)
    }

    /// One volume's files as `(path, byte_size)`, sorted by path. A name that was
    /// never written is reported rather than read as an empty volume: a typo and
    /// a real-but-empty volume would otherwise look the same to the caller.
    pub fn volume_entries(&self, name: &str) -> Result<Vec<(String, u64)>, String> {
        validate_name(name)?;
        if !self.volume_file(name).is_file() {
            return Err(format!("no volume named `{name}`"));
        }
        let map = self.load_volume(name)?;
        let mut files: Vec<(String, u64)> =
            map.into_iter().map(|(path, contents)| (path, contents.len() as u64)).collect();
        files.sort_by(|a, b| a.0.cmp(&b.0));
        Ok(files)
    }
}

/// The state directory plus the locks that make it safe for several runs to
/// share at once.
///
/// A daemon serving one request at a time needed no locking — it was the only
/// writer in the process. Concurrent runs are not: two runs mounting the same
/// volume each read it, each write it, and the second write would quietly erase
/// the first. [`StateDir`]'s methods are plain `std::fs`, so the locking lives
/// here, around the callers rather than inside them, because the critical
/// section is the whole run — load the prior contents, run, write the snapshot —
/// and anything shorter reopens the race the locking exists to close.
///
/// **Every** read and write of a volume or image on disk goes through
/// [`Self::lock_volumes`] or [`Self::lock_image`]. That is the invariant the
/// locking depends on: `write_volume` truncates in place, so a reader that skips
/// the lock can see half a file of partial JSON.
///
/// Locks are keyed by name and never removed, so the maps grow with the number
/// of distinct names a caller has ever used. That is bounded in practice by the
/// caller already holding the token, which is the same trust it takes to fill
/// the state directory deliberately.
pub struct Daemon {
    state: StateDir,
    /// One lock per volume name, so two runs on the same volume serialise while
    /// runs on different ones do not.
    volumes: Mutex<HashMap<String, Arc<Mutex<()>>>>,
    /// One lock per image name, guarding the directory a run reads and a commit
    /// writes.
    images: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl Daemon {
    /// Wrap a resolved state directory with the locks concurrent runs need.
    pub fn new(state: StateDir) -> Daemon {
        Daemon { state, volumes: Mutex::new(HashMap::new()), images: Mutex::new(HashMap::new()) }
    }

    /// The state directory underneath, for the paths only the daemon names.
    pub fn state(&self) -> &StateDir {
        &self.state
    }

    /// The lock for one image, held across a read or a write of its directory.
    /// A run takes this for the compose and releases it before the worker
    /// starts; a commit takes it for the whole freeze.
    pub fn lock_image(&self, name: &str) -> ImageLock {
        ImageLock { mutex: self.mutex_for(&self.images, name), name: name.to_string() }
    }

    /// The locks for a set of volumes, one per distinct name and in a
    /// deterministic order.
    ///
    /// Duplicate names are collapsed rather than locked twice — a spec list may
    /// repeat a name, and a non-reentrant mutex would deadlock against itself.
    /// Sorting is what keeps two runs mounting the same set from taking those
    /// locks in opposite orders and waiting on each other forever.
    pub fn lock_volumes(&self, names: &[String]) -> VolumeLocks {
        let ordered: Vec<String> = names
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .cloned()
            .collect();
        let mutexes = ordered.iter().map(|name| self.mutex_for(&self.volumes, name)).collect();
        VolumeLocks { mutexes, names: ordered }
    }

    /// Find or create the mutex for `name` in `map`, and hand back a share of
    /// it. The map is released immediately; the shared mutex is what a caller
    /// locks, so a long critical section never blocks a lookup for another name.
    fn mutex_for(&self, map: &Mutex<HashMap<String, Arc<Mutex<()>>>>, name: &str) -> Arc<Mutex<()>> {
        let mut table = map.lock().expect("a lock map was poisoned");
        table.entry(name.to_string()).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
    }
}

/// An image's lock. [`Self::hold`] takes it and returns a guard whose scope is
/// the critical section; the lock itself stays beside it, because the guard
/// borrows the mutex it unlocks.
pub struct ImageLock {
    mutex: Arc<Mutex<()>>,
    name: String,
}

impl ImageLock {
    /// The image this lock is for.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Take the lock. Dropping the returned guard ends the critical section.
    pub fn hold(&self) -> std::sync::MutexGuard<'_, ()> {
        self.mutex.lock().expect("an image lock was poisoned")
    }
}

/// The locks for one run's volumes, one per distinct name, in a deterministic
/// order. [`Self::hold`] takes them all; dropping the guards releases them,
/// last acquired first.
pub struct VolumeLocks {
    mutexes: Vec<Arc<Mutex<()>>>,
    names: Vec<String>,
}

impl VolumeLocks {
    /// The distinct volume names these locks are for, sorted.
    pub fn names(&self) -> &[String] {
        &self.names
    }

    /// How many locks are held, which is the count of distinct names asked for.
    pub fn len(&self) -> usize {
        self.names.len()
    }

    /// True when no volume was named — a run with nothing to persist.
    pub fn is_empty(&self) -> bool {
        self.names.is_empty()
    }

    /// Take every lock, in sorted order. Dropping the returned guards releases
    /// them; the set must stay beside them, because the guards borrow it.
    pub fn hold(&self) -> Vec<std::sync::MutexGuard<'_, ()>> {
        self.mutexes
            .iter()
            .map(|mutex| mutex.lock().expect("a volume lock was poisoned"))
            .collect()
    }
}

/// Compose the seed the isolate boots from: the base image's file map with the
/// app folder layered over it, plus each attached volume's saved contents as a
/// writable mount. Both halves travel as JSON the runtime reads off
/// `globalThis` before it runs.
pub fn compose_seed(
    base_json: &str,
    app: &FileMap,
    volumes: &[(String, FileMap)],
    policy: &FsPolicy,
) -> Result<InstanceSeed, String> {
    let mut image: serde_json::Map<String, serde_json::Value> = serde_json::from_str(base_json)
        .map_err(|err| format!("the base image is not a json file map: {err}"))?;
    for (path, contents) in app {
        image.insert(path.clone(), serde_json::Value::String(contents.clone()));
    }
    let image = serde_json::to_string(&image).map_err(|err| format!("cannot encode the image: {err}"))?;

    let mut mounts = Vec::with_capacity(volumes.len());
    for (mount, files) in volumes {
        let mut object = serde_json::Map::new();
        object.insert("mount".to_string(), serde_json::Value::String(mount.clone()));
        object.insert("files".to_string(), serde_json::json!(files));
        mounts.push(serde_json::Value::Object(object));
    }
    let volumes = serde_json::to_string(&mounts).map_err(|err| format!("cannot encode the volumes: {err}"))?;

    // The process identity is the caller's to set; a seed built only for the
    // cap check carries the default one.
    let seed = InstanceSeed { image, volumes, ..InstanceSeed::empty() };
    if seed.byte_len() > policy.max_seed_bytes {
        return Err(format!(
            "the seed is {} bytes, over the {} byte limit",
            seed.byte_len(),
            policy.max_seed_bytes
        ));
    }
    Ok(seed)
}

/// Layer one file map over another: `over` wins where both hold a path. The
/// same rule the seed composition applies to an app folder, used here so a
/// committed image keeps the base it was built on.
pub fn merge_file_maps(base: &FileMap, over: &FileMap) -> FileMap {
    let mut merged = base.clone();
    merged.extend(over.iter().map(|(path, contents)| (path.clone(), contents.clone())));
    merged
}

/// A base image's file map from its JSON form, naming the image when it is not
/// one — the caller is about to commit over it, and a base that is not a file
/// map would silently produce an image of the wrong shape.
fn parse_image_map(json: &str, image: &str) -> Result<FileMap, String> {
    serde_json::from_str(json).map_err(|err| format!("image `{image}` is not a file map: {err}"))
}

/// A `NAME:MOUNT` volume specification, split and validated. Both halves are
/// checked before anything touches disk.
pub fn parse_volume_spec(spec: &str) -> Result<(String, String), String> {
    let Some((name, mount)) = spec.split_once(':') else {
        return Err(format!("volume `{spec}` must be NAME:MOUNT"));
    };
    validate_name(name).map_err(|err| format!("volume `{spec}`: {err}"))?;
    validate_mount(mount).map_err(|err| format!("volume `{spec}`: {err}"))?;
    Ok((name.to_string(), mount.to_string()))
}

/// Read a directory of files into a flat posix-keyed map: the same rules the
/// build script uses for checked-in images, so an app folder and an image are
/// indistinguishable by the time they reach the isolate.
///
/// Regular files only — a symlink is skipped rather than followed, so a link in
/// an app folder cannot pull in host files outside it. Contents are text: the
/// whole pipeline is string-based, so a file that is not valid utf8 cannot be
/// represented. Those are skipped with a warning rather than failing the run —
/// a dependency's unused image should not keep an app from starting — and a
/// service that later tries to read one gets the ordinary ENOENT.
pub fn load_file_map(dir: &Path) -> Result<FileMap, String> {
    let mut files = FileMap::new();
    collect(dir, "/", &mut files)?;
    Ok(files)
}

fn collect(dir: &Path, prefix: &str, files: &mut FileMap) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|err| format!("cannot read {}: {err}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("cannot read {}: {err}", dir.display()))?;
        let name = entry.file_name();
        let name = name
            .to_str()
            .ok_or_else(|| format!("non-utf8 file name under {}", dir.display()))?;

        // Posix keys, whatever the host's separator is, so the same folder
        // loads identically on Windows and POSIX.
        let posix = format!("{prefix}{name}");
        let file_type = entry
            .file_type()
            .map_err(|err| format!("cannot stat {}: {err}", entry.path().display()))?;
        if file_type.is_dir() {
            collect(&entry.path(), &format!("{posix}/"), files)?;
        } else if file_type.is_file() {
            let bytes = std::fs::read(entry.path())
                .map_err(|err| format!("cannot read {}: {err}", entry.path().display()))?;
            match String::from_utf8(bytes) {
                Ok(contents) => {
                    files.insert(posix, contents);
                }
                Err(_) => eprintln!(
                    "warning: skipping non-text file {} (the sandbox filesystem holds text only)",
                    entry.path().display()
                ),
            }
        }
        // Symlinks and anything else are simply not part of the image.
    }
    Ok(())
}

fn parse_file_map(bytes: &[u8], file: &Path) -> Result<FileMap, String> {
    serde_json::from_slice::<FileMap>(bytes)
        .map_err(|err| format!("{} is not a file map: {err}", file.display()))
}

fn list_dirs(dir: &Path) -> Result<Vec<String>, String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(format!("cannot read {}: {err}", dir.display())),
    };

    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("cannot read {}: {err}", dir.display()))?;
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if validate_name(name).is_err() {
            continue;
        }
        names.push(name.to_string());
    }
    names.sort();
    Ok(names)
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::Duration;

    use super::*;

    /// Run `n` workers sharing `shared`, and fail unless every one of them
    /// reports back in time. A lock that never releases must fail a test rather
    /// than hang the whole suite, so the wait is bounded and the workers are
    /// disposable threads whose panic would carry through the channel anyway.
    ///
    /// Every worker is started before any is waited on: spawning and waiting in
    /// one loop would run them one at a time, and a test of contention would
    /// quietly test nothing.
    fn parallel<T: Send + Sync + 'static>(n: usize, shared: Arc<T>, work: Arc<dyn Fn(usize, &T) + Send + Sync>) {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut workers = Vec::with_capacity(n);
        for index in 0..n {
            let shared = Arc::clone(&shared);
            let work = Arc::clone(&work);
            let tx = tx.clone();
            workers.push(std::thread::spawn(move || {
                work(index, &shared);
                let _ = tx.send(());
            }));
        }
        drop(tx);
        for _ in 0..n {
            rx.recv_timeout(Duration::from_secs(30))
                .expect("a worker did not finish: a lock is held, or a deadlock closed");
        }
        for worker in workers {
            worker.join().expect("a worker thread panicked");
        }
    }

    /// One run's read→bump→write on a volume, holding its lock for the whole
    /// cycle the way `run_app` does. Anything shorter would let two runs both
    /// read the same prior count and both write the same next one.
    fn bump_volume(daemon: &Daemon, volume: &str) {
        let locks = daemon.lock_volumes(&[volume.to_string()]);
        let _guards = locks.hold();

        let state = daemon.state();
        let mut map = state.load_volume(volume).unwrap();
        let key = "/data/count";
        let previous = map.get(key).and_then(|value| value.parse::<usize>().ok()).unwrap_or(0);
        map.insert(key.to_string(), (previous + 1).to_string());
        let json = state.volume_json(volume, &map, &FsPolicy::default()).unwrap();
        state.write_volume(volume, &json).unwrap();
    }

    #[test]
    fn lock_volumes_dedupes_and_sorts() {
        let daemon = Daemon::new(StateDir::resolve(Some("/tmp/fernbox-lock-order")).unwrap());

        // `["b", "a", "b"]` asks for three locks; the answer is two, because the
        // third would wait on the first forever, and sorted, because two runs
        // mounting the same set must take those locks in one order.
        let locks = daemon.lock_volumes(&["b".into(), "a".into(), "b".into()]);
        assert_eq!(locks.names(), ["a", "b"]);
        assert_eq!(locks.len(), 2);

        // An empty spec list is a run with nothing to persist, not a run that
        // locks nothing meaningfully.
        let empty = daemon.lock_volumes(&[]);
        assert!(empty.is_empty());
    }

    #[test]
    fn repeated_volume_name_does_not_self_deadlock() {
        let daemon = Daemon::new(StateDir::resolve(Some("/tmp/fernbox-lock-dedupe")).unwrap());

        // Holding the guards is where a duplicate name would bite: the second
        // acquire would block on a mutex the caller already holds.
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let locks = daemon.lock_volumes(&["data".into(), "data".into()]);
            let _guards = locks.hold();
            let _ = tx.send(locks.names().to_vec());
        });
        let names = rx
            .recv_timeout(Duration::from_secs(30))
            .expect("locking a repeated name deadlocked");
        assert_eq!(names, ["data"]);
    }

    #[test]
    fn concurrent_runs_on_one_volume_lose_no_updates() {
        let dir = "/tmp/fernbox-lock-one-volume";
        let _ = std::fs::remove_dir_all(dir);
        let daemon = Arc::new(Daemon::new(StateDir::resolve(Some(dir)).unwrap()));

        // Eight read-modify-write cycles on the same volume serialise on one
        // lock, so the persisted count is exactly eight. A missing lock would
        // leave some of the updates overwritten and the count short.
        parallel(8, Arc::clone(&daemon), Arc::new(|_, daemon| bump_volume(daemon, "data")));

        let map = daemon.state().load_volume("data").unwrap();
        assert_eq!(map["/data/count"], "8");
    }

    #[test]
    fn concurrent_runs_on_distinct_volumes_do_not_contend() {
        let dir = "/tmp/fernbox-lock-many-volumes";
        let _ = std::fs::remove_dir_all(dir);
        let daemon = Arc::new(Daemon::new(StateDir::resolve(Some(dir)).unwrap()));

        // Eight volumes, one run each. A lock coarser than the name would
        // serialise these too — still correct, but not concurrent — and a
        // deadlock anywhere in acquisition would never finish.
        parallel(
            8,
            Arc::clone(&daemon),
            Arc::new(|index, daemon| bump_volume(daemon, &format!("v{index}"))),
        );

        for index in 0..8 {
            let map = daemon.state().load_volume(&format!("v{index}")).unwrap();
            assert_eq!(map["/data/count"], "1", "volume v{index} lost its only write");
        }
    }

    #[test]
    fn volume_specs_split_and_validate() {
        assert_eq!(parse_volume_spec("data:/data").unwrap(), ("data".into(), "/data".into()));
        assert!(parse_volume_spec("data").is_err());
        assert!(parse_volume_spec("data:").is_err());
        assert!(parse_volume_spec("../etc:/data").is_err());
        assert!(parse_volume_spec("data:relative").is_err());
        assert!(parse_volume_spec("data:/data/../etc").is_err());
    }

    #[test]
    fn commit_layers_the_volume_over_its_base() {
        let base = r#"{"/etc/hosts": "hosts", "/lib/base.js": "base", "/data/count": "1"}"#;
        let mut volume = FileMap::new();
        volume.insert("/data/count".into(), "2".into());
        volume.insert("/data/new".into(), "added".into());

        let merged = merge_file_maps(&parse_image_map(base, "base").unwrap(), &volume);
        // The base survives where the volume did not write, and the volume wins
        // where it did.
        assert_eq!(merged["/etc/hosts"], "hosts");
        assert_eq!(merged["/lib/base.js"], "base");
        assert_eq!(merged["/data/count"], "2");
        assert_eq!(merged["/data/new"], "added");
        assert_eq!(merged.len(), 4);
    }

    #[test]
    fn compose_layers_app_over_image_and_caps_the_seed() {
        let base = r#"{"/etc/hosts": "hosts", "/lib/base.js": "base"}"#;
        let mut app = FileMap::new();
        app.insert("/lib/base.js".into(), "app".into());
        app.insert("/lib/app.js".into(), "app".into());
        let policy = FsPolicy::default();

        let seed = compose_seed(base, &app, &[], &policy).unwrap();
        let image: serde_json::Value = serde_json::from_str(&seed.image).unwrap();
        assert_eq!(image["/etc/hosts"], "hosts");
        assert_eq!(image["/lib/base.js"], "app");
        assert_eq!(image["/lib/app.js"], "app");
        assert_eq!(seed.volumes, "[]");

        let big = FileMap::from([("/big".into(), "x".repeat(policy.max_seed_bytes))]);
        assert!(compose_seed(base, &big, &[], &policy).is_err());
    }

    #[test]
    fn compose_serialises_volumes_as_mounts() {
        let files = FileMap::from([("/data/count".into(), "1".into())]);
        let seed = compose_seed("{}", &FileMap::new(), &[("data".into(), files)], &FsPolicy::default()).unwrap();
        let volumes: serde_json::Value = serde_json::from_str(&seed.volumes).unwrap();
        assert_eq!(volumes[0]["mount"], "data");
        assert_eq!(volumes[0]["files"]["/data/count"], "1");
    }

    #[test]
    fn volume_entries_reports_sizes_sorted_and_refuses_unknown_volumes() {
        let dir = "/tmp/fernbox-volume-entries-test";
        let _ = std::fs::remove_dir_all(dir);
        let state = StateDir::resolve(Some(dir)).unwrap();
        let map = FileMap::from([
            ("/data/z".to_string(), "xy".to_string()),
            ("/data/a".to_string(), "1".to_string()),
        ]);
        let json = state.volume_json("data", &map, &FsPolicy::default()).unwrap();
        state.write_volume("data", &json).unwrap();

        let entries = state.volume_entries("data").unwrap();
        assert_eq!(entries, vec![("/data/a".to_string(), 1), ("/data/z".to_string(), 2)]);

        // A typo is not an empty volume: reading a name that was never written
        // has to say so, or the two look identical at the terminal.
        let err = state.volume_entries("nope").unwrap_err();
        assert!(err.contains("no volume named `nope`"), "{err}");
    }

    #[test]
    fn volume_json_rejects_an_oversized_map() {
        let state = StateDir::resolve(Some("/tmp/fernbox-volume-json-test")).unwrap();
        let policy = FsPolicy::default();
        let fits = FileMap::from([("/ok".into(), "small".into())]);
        let over = FileMap::from([("/big".into(), "x".repeat(policy.max_volume_bytes))]);

        assert!(state.volume_json("data", &fits, &policy).is_ok());
        // Serialised length is the key plus its contents and quotes, so this is
        // comfortably over the limit.
        assert!(state.volume_json("data", &over, &policy).is_err());
        // A name that would escape the state directory is rejected here too,
        // before any path is joined.
        assert!(state.volume_json("../escape", &fits, &policy).is_err());
    }
}
