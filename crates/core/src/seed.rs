//! What an instance is booted from, and the rules names must satisfy.
//!
//! The daemon composes a seed from a base image, an app folder, and any attached
//! volumes, then hands it to [`Vm::new`](crate::vm::Vm::new). Keeping the
//! composition on the daemon side is deliberate: it is the trust root and the
//! only component that touches host disk, and the isolate never learns a host
//! path — only the file contents that were assembled for it.

/// The base images bundled into the binary, one per checked-in directory under
/// `runtime/images/`. Each entry is `(name, json)`; the json is a bare
/// `{"posix/path": "contents"}` map that both the daemon (to merge an app folder
/// in) and the isolate (to seed the fs) can consume.
mod images {
    include!(concat!(env!("OUT_DIR"), "/images.rs"));
}

/// Caps on how much filesystem state an instance may bring in or leave behind.
///
/// Enforced by the daemon when it composes the seed and when it stores a
/// snapshot — that is where host disk is at stake. In-isolate memory is bounded
/// separately by the heap limit.
#[derive(Debug, Clone, Copy)]
pub struct FsPolicy {
    /// Total bytes of file contents an instance may be seeded with: the base
    /// image, the app folder, and every volume's prior contents together.
    pub max_seed_bytes: usize,
    /// The largest a single volume's snapshot may be when written back to disk.
    pub max_volume_bytes: usize,
}

impl Default for FsPolicy {
    fn default() -> FsPolicy {
        FsPolicy { max_seed_bytes: 64 * 1024 * 1024, max_volume_bytes: 16 * 1024 * 1024 }
    }
}

/// The filesystem an instance boots with.
///
/// Both fields are JSON literals — `image` is a `{"path": "contents"}` map and
/// `volumes` is a `[{ "mount": "/data", "files": {...} }]` array — because the
/// runtime reads them off `globalThis` before it runs, and the daemon can build
/// them by serializing what it read from disk.
#[derive(Debug, Clone)]
pub struct InstanceSeed {
    /// The read-only layers merged into one map: base image plus app folder.
    pub image: String,
    /// The writable, pre-seeded layers that get snapshotted back on exit.
    pub volumes: String,
    /// The caller's environment, as `KEY=VALUE` pairs. The sandbox never sees
    /// the host's environment — these are the whole of `process.env`.
    pub env: Vec<String>,
    /// `process.argv`: `["node", entrypoint, ...args]`, so `argv.slice(2)`
    /// behaves the way it does under a real node.
    pub argv: Vec<String>,
    /// The virtual path the entrypoint sits at, so the top level gets a real
    /// `__dirname`. `/main.js` unless the caller named something else.
    pub entrypoint: String,
    /// What the caller piped in, as the whole of `process.stdin`. Empty unless
    /// something was piped: a terminal is never read, because there is no way
    /// to know when the caller is done typing.
    pub stdin: String,
}

impl InstanceSeed {
    /// A seed from an embedded image with no app folder and no volumes. Used by
    /// the examples and the bare `sandbox` path.
    pub fn embedded(image: &str) -> Result<InstanceSeed, String> {
        let json = embedded_image_json(image)
            .ok_or_else(|| format!("no embedded image named `{image}`"))?;
        Ok(InstanceSeed::bare(json.to_string(), "[]".to_string()))
    }

    /// A seed with nothing in it at all: no image layers, no volumes. For the
    /// cases that want a bare isolate with the API surface available.
    pub fn empty() -> InstanceSeed {
        InstanceSeed::bare("{}".to_string(), "[]".to_string())
    }

    /// The shared tail of the constructors: the same process identity a seed
    /// with no caller-supplied identity gets.
    fn bare(image: String, volumes: String) -> InstanceSeed {
        InstanceSeed {
            image,
            volumes,
            env: Vec::new(),
            argv: vec!["node".to_string(), "/main.js".to_string()],
            entrypoint: "/main.js".to_string(),
            stdin: String::new(),
        }
    }

    /// `process.argv` from the entrypoint and the arguments after it.
    pub fn argv_for(entrypoint: &str, args: &[String]) -> Vec<String> {
        let mut argv = vec!["node".to_string(), entrypoint.to_string()];
        argv.extend_from_slice(args);
        argv
    }

    /// Total bytes of file contents this seed carries, for cap checks.
    pub fn byte_len(&self) -> usize {
        self.image.len() + self.volumes.len()
    }
}

/// The JSON file map of an embedded image, or `None` if there is none by that
/// name.
pub fn embedded_image_json(name: &str) -> Option<&'static str> {
    images::IMAGES
        .iter()
        .find(|(n, _)| *n == name)
        .map(|(_, json)| *json)
}

/// Names of the images bundled into the binary.
pub fn available_embedded_images() -> Vec<&'static str> {
    images::IMAGES.iter().map(|(name, _)| *name).collect()
}

/// An image or volume name. These join into paths under the state directory, so
/// they must reject anything that could escape it: no separators, no `..`, no
/// empty, and bounded so a name cannot become a pathologically long one.
pub fn validate_name(name: &str) -> Result<(), String> {
    const MAX: usize = 64;
    let valid = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-');
    let ok = !name.is_empty()
        && name.len() <= MAX
        && name.starts_with(|c: char| c.is_ascii_alphanumeric())
        && name.chars().all(valid);

    if ok {
        Ok(())
    } else {
        Err(format!(
            "invalid name `{name}`: use up to {MAX} letters, digits, `.`, `_`, or `-`, starting with a letter or digit"
        ))
    }
}

/// Where a volume mounts inside the sandbox: an absolute posix path with no `..`
/// component. It is a *virtual* path — the sandbox has no host filesystem — but
/// a relative or escaping mount would still misdirect writes, so it is checked
/// like the paths it controls.
pub fn validate_mount(mount: &str) -> Result<(), String> {
    if !mount.starts_with('/') {
        return Err(format!("mount `{mount}` must be an absolute path"));
    }
    if mount.split('/').any(|part| part == "..") {
        return Err(format!("mount `{mount}` must not contain `..`"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_images_exist_and_are_json_maps() {
        let names = available_embedded_images();
        assert!(names.contains(&"base"));
        assert!(names.contains(&"minimal"));

        let base = embedded_image_json("base").expect("base image is bundled");
        assert!(base.starts_with('{'));
        // An image is a flat map of absolute paths to contents.
        let map: serde_json::Value = serde_json::from_str(base).unwrap();
        let obj = map.as_object().unwrap();
        assert!(obj.keys().all(|k| k.starts_with('/')));
        assert!(obj.contains_key("/etc/hosts"));
    }

    #[test]
    fn personalities_layer_on_their_parents() {
        // Inheritance is build-time only, so every image is still one flat map —
        // what distinguishes them is which files that map holds, and a child's
        // own copy of a parent's path is the one that survives.
        let files = |name: &str| {
            serde_json::from_str::<serde_json::Value>(embedded_image_json(name).expect("image is bundled"))
                .unwrap()
                .as_object()
                .unwrap()
                .clone()
        };

        // `fernos` keeps `base`'s /bin and the fflate its npm needs, and adds a
        // directory of its own.
        let fernos = files("fernos");
        assert!(fernos.contains_key("/bin/ls.js"));
        assert!(fernos.contains_key("/node_modules/fflate/index.js"));
        assert!(fernos.contains_key("/usr/local/bin/grep.js"));
        assert!(fernos.contains_key("/etc/fernbox/fernbox.conf"));

        // `alpine` builds on `minimal` instead, so it has no inherited /bin: it
        // ships its own, and the applets behind it are not commands themselves.
        let alpine = files("alpine");
        assert!(alpine.contains_key("/bin/busybox.js"));
        assert!(alpine.contains_key("/usr/lib/busybox/applets.js"));
        assert!(!alpine.keys().any(|p| p.starts_with("/usr/local/bin")));
        assert!(!alpine.contains_key("/node_modules/fflate/index.js"));

        // `ubuntu` overrides the identity it inherited rather than the commands.
        let ubuntu = files("ubuntu");
        assert!(ubuntu.contains_key("/bin/ls.js"));
        assert!(ubuntu["/etc/os-release"].as_str().unwrap().contains("Ubuntu"));
        // A personality's own os-release replaces the base one it layered on.
        assert!(os_release_says("base", "base image"));
        assert!(os_release_says("fernos", "fernos"));
        assert!(!os_release_says("fernos", "base image"));
    }

    fn os_release_says(name: &str, expected: &str) -> bool {
        embedded_image_json(name)
            .and_then(|json| serde_json::from_str::<serde_json::Value>(json).ok())
            .and_then(|map| map["/etc/os-release"].as_str().map(|s| s.contains(expected)))
            .unwrap_or(false)
    }

    #[test]
    fn unknown_image_is_none() {
        assert!(embedded_image_json("nope").is_none());
    }

    #[test]
    fn names_reject_what_could_escape() {
        assert!(validate_name("data").is_ok());
        assert!(validate_name("my-image_2.0").is_ok());
        assert!(validate_name("").is_err());
        assert!(validate_name("../etc").is_err());
        assert!(validate_name("a/b").is_err());
        assert!(validate_name("-leading").is_err());
        assert!(validate_name(&"x".repeat(65)).is_err());
    }

    #[test]
    fn mounts_must_be_absolute_and_contained() {
        assert!(validate_mount("/data").is_ok());
        assert!(validate_mount("/var/data").is_ok());
        assert!(validate_mount("data").is_err());
        assert!(validate_mount("/data/../etc").is_err());
    }

    #[test]
    fn empty_and_embedded_seeds_are_well_formed() {
        let embedded = InstanceSeed::embedded("base").unwrap();
        assert!(serde_json::from_str::<serde_json::Value>(&embedded.image).is_ok());
        assert_eq!(embedded.volumes, "[]");

        let empty = InstanceSeed::empty();
        assert_eq!(empty.image, "{}");
        assert!(empty.byte_len() > 0);
    }
}
