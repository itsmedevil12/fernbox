//! The FernBoxfile: a small declarative build format.
//!
//! A bundled image lives in `runtime/images/<name>/` and is compiled into the
//! binary, so adding one means rebuilding Rust. That is fine for the five images
//! that ship and wrong for an app author who wants an image of their own. A
//! FernBoxfile is the way out: a text file, a handful of keywords, and an image
//! that lands in the state directory without touching a compiler.
//!
//! ```text
//! # FernBoxfile
//! FROM base
//! WORKDIR /app
//! COPY ./src /app
//! ENV NODE_ENV=production
//! CMD main.js
//! ```
//!
//! The format is deliberately not a Dockerfile. Every keyword here is one the
//! runtime can actually honour; there is no multi-stage build and no `ARG`,
//! because each would need machinery this does not have and a half-implemented
//! keyword is worse than an absent one.
//!
//! `RUN` is the one keyword that executes code, and it is worth being precise
//! about what that means. A build step is an ordinary sandboxed run: it boots a
//! worker, has the image built so far mounted at `/`, executes the command
//! through `/bin/sh`, and takes the resulting filesystem as the next layer. It
//! gets no network unless the build granted it, no longer than the deadline the
//! build set, and no more memory. So a FernBoxfile cannot do anything at build
//! time that the same command could not do at run time — the trust story is
//! unchanged, which is the only reason `RUN` is acceptable at all.
//!
//! Three rules shape the parser:
//!
//! * **Unknown keywords are errors.** A typo'd `COPY` that was silently ignored
//!   would produce an image missing files, and the failure would surface as a
//!   confusing `ENOENT` at run time instead of a line number at build time.
//! * **Paths are contained.** `COPY` sources must sit under the build context
//!   and destinations must be absolute and free of `..`, because a build file is
//!   shared code and a hostile one must not be able to read the host.
//! * **Later keywords win.** `ENV` twice sets the second value, `COPY` onto a
//!   path that already exists replaces it — the same overwrite-in-order rule the
//!   image composer already uses, so a build file and a `commit` behave alike.

use std::path::{Path, PathBuf};

use crate::state::FileMap;

/// One instruction, as written.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Instruction {
    /// Layer this image underneath. Required, exactly once.
    From(String),
    /// Copy a host path into the image at an absolute path.
    Copy { source: PathBuf, dest: String },
    /// Set an environment variable the run will see.
    Env { key: String, value: String },
    /// The entrypoint an app runs with, unless the caller names one.
    Cmd(String),
    /// The directory a run starts in, if the runtime ever honours one.
    Workdir(String),
    /// A shell command to run while building.
    Run(String),
}

/// A parsed build file: the instructions in order, plus the entrypoint and
/// environment they declare.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Plan {
    pub from: Option<String>,
    pub copies: Vec<(PathBuf, String)>,
    pub env: Vec<(String, String)>,
    pub cmd: Option<String>,
    pub workdir: Option<String>,
    pub runs: Vec<String>,
}

impl Plan {
    /// Fold the instructions into the plan the builder executes.
    ///
    /// `ENV` and `COPY` accumulate rather than replace, because that is what a
    /// build file means: two `COPY` lines are two copies, and two `ENV` lines
    /// for different variables are two variables. A repeated `ENV` key keeps its
    /// position and takes the later value, so `KEY=two` after `KEY=one` is
    /// `two` — later wins, the same as an override file.
    fn from_instructions(instructions: Vec<Instruction>) -> Result<Plan, String> {
        let mut plan = Plan::default();

        for instruction in instructions {
            match instruction {
                Instruction::From(name) => {
                    if let Some(previous) = &plan.from {
                        return Err(format!(
                            "FROM appears twice (`{previous}`, then `{name}`); a FernBoxfile layers on exactly one image"
                        ));
                    }
                    plan.from = Some(name);
                }
                Instruction::Copy { source, dest } => plan.copies.push((source, dest)),
                Instruction::Env { key, value } => match plan.env.iter_mut().find(|(k, _)| *k == key) {
                    Some(slot) => slot.1 = value,
                    None => plan.env.push((key, value)),
                },
                Instruction::Cmd(cmd) => plan.cmd = Some(cmd),
                Instruction::Workdir(dir) => plan.workdir = Some(dir),
                Instruction::Run(command) => plan.runs.push(command),
            }
        }

        if plan.from.is_none() {
            return Err("the FernBoxfile has no FROM: every image layers on one, such as `FROM base`".into());
        }
        Ok(plan)
    }
}

/// Parse a FernBoxfile.
///
/// `context` is the directory the file lives in, and every `COPY` source is
/// resolved against it and then checked to be inside it — a build file may name
/// a path in its own tree and nothing outside.
pub fn parse(text: &str, context: &Path) -> Result<Plan, String> {
    let mut instructions = Vec::new();

    for (index, raw) in text.lines().enumerate() {
        let number = index + 1;
        // A `#` anywhere starts a comment, so a trailing note is fine.
        let line = raw.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }

        let (keyword, rest) = split_keyword(line);
        let instruction = match keyword.to_ascii_uppercase().as_str() {
            "FROM" => Instruction::From(image_name(rest, number)?),
            "COPY" => {
                let (source, dest) = split_last_word(rest).ok_or_else(|| {
                    format!("line {number}: COPY needs a source and a destination, as `COPY ./src /app`")
                })?;
                Instruction::Copy {
                    source: resolve_source(source, context, number)?,
                    dest: image_path(dest, number)?,
                }
            }
            "ENV" => {
                // Both `ENV KEY=value` and `ENV KEY value` are accepted, because
                // both spellings are muscle memory and neither is ambiguous.
                // The `=` form is tried first: it is one token, so a value with
                // spaces in quotes survives, and `split_last_word` would split
                // `NODE_ENV=production` on nothing anyway.
                let (key, value) = match rest.split_once('=') {
                    Some((key, value)) => (key.trim(), value.trim()),
                    None => split_last_word(rest).ok_or_else(|| {
                        format!("line {number}: ENV needs a name and a value, as `ENV NODE_ENV=production`")
                    })?,
                };
                Instruction::Env { key: env_key(key, number)?, value: unquote(value) }
            }
            "RUN" => {
                // The command is a shell line, not a path, so it is taken
                // verbatim. It is never interpolated into anything: it becomes
                // the source of a sandboxed run.
                if rest.is_empty() {
                    return Err(format!("line {number}: RUN needs a command, as `RUN npm install`"));
                }
                Instruction::Run(rest.to_string())
            }
            "CMD" => Instruction::Cmd(image_path(rest, number)?),
            "WORKDIR" => Instruction::Workdir(image_path(rest, number)?),
            "" => continue,
            other => {
                return Err(format!(
                    "line {number}: `{other}` is not a FernBoxfile keyword; \
                     expected one of FROM, COPY, RUN, ENV, CMD, WORKDIR"
                ))
            }
        };
        instructions.push(instruction);
    }

    Plan::from_instructions(instructions)
}

/// Split `KEYWORD rest` on the first run of whitespace.
fn split_keyword(line: &str) -> (&str, &str) {
    match line.find(char::is_whitespace) {
        Some(at) => (&line[..at], line[at..].trim()),
        None => (line, ""),
    }
}

/// Split `first ... last` into everything before the last word and the last
/// word, which is how `COPY` and `ENV` distinguish their two arguments while
/// still allowing spaces in neither. A single word returns `None`: both
/// keywords are two-argument forms.
fn split_last_word(rest: &str) -> Option<(&str, &str)> {
    let (head, tail) = rest.rsplit_once(char::is_whitespace)?;
    let head = head.trim();
    let tail = tail.trim();
    if head.is_empty() || tail.is_empty() {
        None
    } else {
        Some((head, tail))
    }
}

/// An image name: a bare identifier so nothing can name outside the state
/// directory.
fn image_name(rest: &str, number: usize) -> Result<String, String> {
    let name = rest.trim();
    if name.is_empty() || name.contains(char::is_whitespace) {
        return Err(format!("line {number}: FROM needs exactly one image name"));
    }
    // The daemon's own name rule, so a name that parses here is one `images`
    // and `run --image` will accept.
    fernbox_core::validate_name(name).map_err(|err| format!("line {number}: {err}"))?;
    Ok(name.to_string())
}

/// An absolute path inside the image, with no `..` anywhere.
fn image_path(rest: &str, number: usize) -> Result<String, String> {
    let path = unquote(rest.trim());
    if !path.starts_with('/') {
        return Err(format!("line {number}: `{path}` must be an absolute path inside the image, such as /app"));
    }
    if path.split('/').any(|part| part == "..") {
        return Err(format!("line {number}: `{path}` must not contain `..`"));
    }
    Ok(path)
}

/// An environment variable name.
fn env_key(key: &str, number: usize) -> Result<String, String> {
    let key = key.trim();
    let valid = !key.is_empty()
        && key.chars().next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !valid {
        return Err(format!("line {number}: `{key}` is not a valid environment variable name"));
    }
    Ok(key.to_string())
}

/// Strip one layer of matching quotes, so a value with spaces can be written.
fn unquote(text: &str) -> String {
    let text = text.trim();
    for quote in ['"', '\''] {
        if text.len() >= 2 && text.starts_with(quote) && text.ends_with(quote) {
            return text[1..text.len() - 1].to_string();
        }
    }
    text.to_string()
}

/// Resolve a `COPY` source against the build context and refuse anything that
/// climbs out of it.
fn resolve_source(source: &str, context: &Path, number: usize) -> Result<PathBuf, String> {
    let source = unquote(source);
    let candidate = context.join(&source);

    // Lexical containment first, so a `..` is rejected whether or not the path
    // it names exists — the canonicalise check below cannot say anything about a
    // path that is not there. It is defence in depth rather than the load-bearing
    // check: mutating this one away leaves the escape test passing, because the
    // canonical comparison still catches `..` whenever the target resolves.
    if source.split(['/', '\\']).any(|part| part == "..") {
        return Err(format!(
            "line {number}: `{source}` must not contain `..`; a COPY source stays inside the build context"
        ));
    }

    let resolved = std::fs::canonicalize(&candidate)
        .map_err(|err| format!("line {number}: cannot read COPY source `{source}`: {err}"))?;
    let root = std::fs::canonicalize(context)
        .map_err(|err| format!("cannot read the build context: {err}"))?;
    // The lexical check above catches `..`, but a symlink inside the context can
    // still point out of it; canonicalising both and comparing is what catches
    // that one.
    if !resolved.starts_with(&root) {
        return Err(format!(
            "line {number}: `{source}` resolves outside the build context ({})",
            root.display()
        ));
    }
    Ok(resolved)
}

/// Fold a copy source into a file map at its image destination.
///
/// A directory copies its whole tree; a file copies itself to the destination
/// named. A destination that ends in `/` is treated as a directory and gets the
/// source's own name appended, which is what `COPY ./lib /app/lib/` means.
fn stage_copy(map: &mut FileMap, source: &Path, dest: &str) -> Result<(), String> {
    let mut collected = FileMap::new();
    if source.is_dir() {
        // `load_file_map` applies the source directory's own ignore files, so a
        // `COPY ./src /app` skips `node_modules` for the same reason a git
        // checkout does.
        let tree = crate::state::load_file_map(source)?;
        for (path, contents) in tree {
            // `load_file_map` roots a tree at `/`; re-root it at the image path.
            collected.insert(join_image_path(dest, &path), contents);
        }
    } else {
        let contents = std::fs::read(source)
            .map_err(|err| format!("cannot read {}: {err}", source.display()))?;
        let contents = String::from_utf8(contents).map_err(|_| {
            format!(
                "{} is not valid UTF-8; the sandbox filesystem holds text only",
                source.display()
            )
        })?;
        // A destination ending in `/` names a directory, so the file keeps its
        // own name inside it.
        let target = if dest.ends_with('/') {
            let name = source
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| format!("cannot name {}", source.display()))?;
            join_image_path(dest, name)
        } else {
            dest.to_string()
        };
        collected.insert(target, contents);
    }

    for (path, contents) in collected {
        map.insert(path, contents);
    }
    Ok(())
}

/// Join an image path and a relative one, keeping exactly one slash.
fn join_image_path(base: &str, relative: &str) -> String {
    let base = base.trim_end_matches('/');
    let relative = relative.trim_start_matches('/');
    if relative.is_empty() {
        base.to_string()
    } else if base.is_empty() {
        format!("/{relative}")
    } else {
        format!("{base}/{relative}")
    }
}

/// What a build produced: the image's file map and everything the build file
/// declared about running it.
#[derive(Debug, Clone)]
pub struct Built {
    pub files: FileMap,
    pub env: Vec<(String, String)>,
    pub cmd: Option<String>,
    /// How many ignore rules applied to the copied trees, for the summary.
    pub ignored_rules: usize,
}

impl Built {
    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    pub fn bytes(&self) -> usize {
        self.files.values().map(String::len).sum()
    }
}

/// What an image records about running itself.
///
/// An image is a bare file map and cannot hold this: anything written inside the
/// image directory becomes a file in the sandbox. It is stored beside the image
/// instead, and a run merges it under whatever the caller passed — so an
/// explicit `--env` still wins over the build file's default.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Meta {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub env: Vec<(String, String)>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cmd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workdir: Option<String>,
    /// The image this was built from, for `inspect` and for a clear error when
    /// someone rewrites a build file expecting the old one to be there.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
}

impl Meta {
    pub fn is_empty(&self) -> bool {
        self.env.is_empty() && self.cmd.is_none() && self.workdir.is_none() && self.from.is_none()
    }

    /// The `cmd` as a sandbox path, falling back to the image's own `/`.
    pub fn entrypoint(&self) -> Option<&str> {
        self.cmd.as_deref()
    }
}

/// Build an image in memory: the base map underneath, every copy over it.
///
/// The result is the flat map an image already is, so `FROM` is a build-time
/// convenience exactly as `fernbox.json` is — the isolate never learns that a
/// layer existed.
pub fn build(plan: &Plan, base: &FileMap) -> Result<Built, String> {
    let mut files = base.clone();
    let mut ignored_rules = 0usize;
    for (source, dest) in &plan.copies {
        if source.is_dir() {
            // Counted only for the summary: a build that silently dropped
            // hundreds of files should say the ignore rules existed, so a
            // missing file reads as "ignored" rather than "the copy is broken".
            ignored_rules = ignored_rules.max(crate::ignore::Ignore::load(source)?.len());
        }
        stage_copy(&mut files, source, dest)?;
    }

    // An unsafe path cannot come from `COPY` (its destinations are checked) but
    // could come from a committed base image written by an older bug; the last
    // thing to touch the map before it becomes an image is the right place to
    // say so.
    for path in files.keys() {
        if !path.starts_with('/') || path.split('/').any(|part| part == "..") {
            return Err(format!("the image holds an unsafe path: {path}"));
        }
    }

    Ok(Built { files, env: plan.env.clone(), cmd: plan.cmd.clone(), ignored_rules })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fernbox-fbf-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_minimal_file_parses() {
        let dir = ctx("minimal");
        let plan = parse("FROM base\n", &dir).expect("parses");
        assert_eq!(plan.from.as_deref(), Some("base"));
        assert!(plan.copies.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn comments_and_blank_lines_are_ignored() {
        let dir = ctx("comments");
        let plan = parse(
            "# the header\n\n  FROM base   # trailing note\n\n# and nothing else\n",
            &dir,
        )
        .expect("parses");
        assert_eq!(plan.from.as_deref(), Some("base"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn keywords_are_case_insensitive() {
        let dir = ctx("case");
        let plan = parse("from base\nCmd /app/main.js\n", &dir).expect("parses");
        assert_eq!(plan.from.as_deref(), Some("base"));
        assert_eq!(plan.cmd.as_deref(), Some("/app/main.js"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_unknown_keyword_is_an_error_naming_the_line() {
        let dir = ctx("unknown");
        let err = parse("FROM base\nARG FOO=bar\n", &dir).expect_err("ARG is not supported");
        assert!(err.contains("line 2"), "the error should name the line: {err}");
        assert!(err.contains("ARG"), "the error should name the keyword: {err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn run_commands_are_kept_in_order() {
        // Order is the whole meaning of a RUN list: each step sees what the
        // previous one left behind, so the plan has to preserve it.
        let dir = ctx("runorder");
        let plan = parse("FROM base\nRUN mkdir -p /a\nRUN touch /a/b\n", &dir).expect("parses");
        assert_eq!(plan.runs, vec!["mkdir -p /a", "touch /a/b"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_run_with_no_command_is_refused() {
        let dir = ctx("runempty");
        let err = parse("FROM base\nRUN   \n", &dir).expect_err("RUN needs a command");
        assert!(err.contains("RUN"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_file_without_from_is_refused() {
        let dir = ctx("nofrom");
        // The source has to exist, or the error would be about the missing
        // directory rather than the missing FROM and the test would pass for
        // the wrong reason.
        std::fs::create_dir_all(dir.join("src")).unwrap();
        let err = parse("COPY ./src /app\n", &dir).expect_err("FROM is required");
        assert!(err.contains("FROM"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn from_twice_is_refused() {
        let dir = ctx("twofrom");
        let err = parse("FROM base\nFROM minimal\n", &dir).expect_err("one FROM only");
        assert!(err.contains("twice"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_copy_source_climbing_out_of_the_context_is_refused() {
        let dir = ctx("escape");
        let err = parse("FROM base\nCOPY ../../etc /etc\n", &dir).expect_err("must be contained");
        assert!(err.contains(".."), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_copy_destination_must_be_absolute() {
        let dir = ctx("rel");
        std::fs::create_dir_all(dir.join("src")).unwrap();
        let err = parse("FROM base\nCOPY src app\n", &dir).expect_err("must be absolute");
        assert!(err.contains("absolute"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_dot_dot_destination_is_refused() {
        let dir = ctx("dotdot");
        std::fs::create_dir_all(dir.join("src")).unwrap();
        let err = parse("FROM base\nCOPY src /app/../etc\n", &dir).expect_err("no dot-dot");
        assert!(err.contains(".."), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn env_takes_the_later_value_for_a_repeated_key() {
        let dir = ctx("env");
        let plan = parse("FROM base\nENV A=one\nENV A=two\nENV B=three\n", &dir).expect("parses");
        assert_eq!(
            plan.env,
            vec![("A".to_string(), "two".to_string()), ("B".to_string(), "three".to_string())],
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_file_copies_to_its_destination() {
        let dir = ctx("filecopy");
        std::fs::write(dir.join("main.js"), "console.log('hi')").unwrap();
        let plan = parse("FROM base\nCOPY ./main.js /app/main.js\n", &dir).expect("parses");
        let built = build(&plan, &FileMap::new()).expect("builds");
        assert_eq!(
            built.files.get("/app/main.js").map(String::as_str),
            Some("console.log('hi')"),
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_directory_copies_as_a_tree() {
        let dir = ctx("dircopy");
        let src = dir.join("src");
        std::fs::create_dir_all(src.join("lib")).unwrap();
        std::fs::write(src.join("main.js"), "entry").unwrap();
        std::fs::write(src.join("lib/util.js"), "helper").unwrap();

        let plan = parse("FROM base\nCOPY ./src /app\n", &dir).expect("parses");
        let built = build(&plan, &FileMap::new()).expect("builds");

        assert_eq!(built.files.get("/app/main.js").map(String::as_str), Some("entry"));
        assert_eq!(built.files.get("/app/lib/util.js").map(String::as_str), Some("helper"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_trailing_slash_destination_keeps_the_source_name() {
        let dir = ctx("trailing");
        std::fs::write(dir.join("main.js"), "entry").unwrap();
        let plan = parse("FROM base\nCOPY ./main.js /app/\n", &dir).expect("parses");
        let built = build(&plan, &FileMap::new()).expect("builds");
        assert_eq!(built.files.get("/app/main.js").map(String::as_str), Some("entry"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_base_image_is_underneath_and_copies_win() {
        let dir = ctx("layer");
        std::fs::write(dir.join("os-release"), "mine").unwrap();
        let base = FileMap::from([
            ("/etc/os-release".to_string(), "theirs".to_string()),
            ("/bin/ls.js".to_string(), "ls".to_string()),
        ]);
        let plan = parse("FROM base\nCOPY ./os-release /etc/os-release\n", &dir).expect("parses");
        let built = build(&plan, &base).expect("builds");

        // An inherited file the build overwrites takes the build's copy, and
        // everything else comes through from the base.
        assert_eq!(built.files.get("/etc/os-release").map(String::as_str), Some("mine"));
        assert_eq!(built.files.get("/bin/ls.js").map(String::as_str), Some("ls"));
        assert_eq!(built.file_count(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_non_utf8_copy_source_is_refused() {
        let dir = ctx("binary");
        std::fs::write(dir.join("blob.bin"), [0xff, 0xfe, 0x00]).unwrap();
        let plan = parse("FROM base\nCOPY ./blob.bin /blob.bin\n", &dir).expect("parses");
        let err = build(&plan, &FileMap::new()).expect_err("the fs is text only");
        assert!(err.contains("UTF-8"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_copy_of_a_missing_source_is_refused_at_parse_time() {
        let dir = ctx("missing");
        let err = parse("FROM base\nCOPY ./nope /app\n", &dir).expect_err("the source must exist");
        assert!(err.contains("cannot read"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn workdir_and_cmd_are_the_last_one_written() {
        let dir = ctx("cmd");
        let plan = parse("FROM base\nWORKDIR /app\nWORKDIR /app/sub\nCMD /app/one.js\nCMD /app/two.js\n", &dir)
            .expect("parses");
        assert_eq!(plan.workdir.as_deref(), Some("/app/sub"));
        assert_eq!(plan.cmd.as_deref(), Some("/app/two.js"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
