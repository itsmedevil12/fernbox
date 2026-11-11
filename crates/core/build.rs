use std::path::PathBuf;
use std::process::Command;

fn main() {
    // rusty_v8's build script links winmm and dbghelp on Windows but not the
    // libs backing V8's ETW JIT logging and ICU's timezone registry lookups.
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("windows") {
        println!("cargo:rustc-link-lib=dylib=advapi32");
    }

    bundle_runtime();
    bundle_images();
}

/// Bundle the system-context runtime so core can embed it with `include_str!`.
///
/// Cargo treats the emitted file as an artifact of this build script: any change
/// under `runtime/` re-runs the script, and the include is re-read.
fn bundle_runtime() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let runtime_dir = manifest_dir.join("../../runtime");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let bundle = out_dir.join("virtual_os.js");

    let status = Command::new("node")
        .arg("build.mjs")
        .arg(&bundle)
        .current_dir(&runtime_dir)
        .status()
        .unwrap_or_else(|e| panic!("failed to run node for the runtime bundle: {e}"));

    if !status.success() {
        panic!("esbuild failed to bundle the system-context runtime");
    }

    // Absolute: cargo resolves a relative `rerun-if-changed` against this
    // crate's manifest, where `runtime/` does not exist, and a path it cannot
    // find is ignored rather than watched — which would make every directive
    // here a no-op and let the bundled runtime go stale for a binary that links
    // core as a dependency.
    println!("cargo:rerun-if-changed={}", runtime_dir.join("src").display());
    println!("cargo:rerun-if-changed={}", runtime_dir.join("src/user").display());
    println!("cargo:rerun-if-changed={}", runtime_dir.join("build.mjs").display());
    println!("cargo:rerun-if-changed={}", runtime_dir.join("package.json").display());
}

/// Emit a registry of the base images found under `runtime/images/`.
///
/// Each subdirectory is one image; build.mjs already wrote an `image_<name>.json`
/// next to the runtime bundle holding its file map. The generated table is the
/// single place the Rust side learns which images exist, so a new checked-in
/// image needs no code change here.
fn bundle_images() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let images_dir = manifest_dir.join("../../runtime/images");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());

    let mut names: Vec<String> = std::fs::read_dir(&images_dir)
        .unwrap_or_else(|e| panic!("cannot read images dir {}: {e}", images_dir.display()))
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter_map(|entry| entry.file_name().to_str().map(str::to_owned))
        .collect();
    names.sort();

    let mut out = String::from("pub const IMAGES: &[(&str, &str)] = &[\n");
    for name in &names {
        out.push_str(&format!(
            "    ({name:?}, include_str!(\"image_{name}.json\")),\n"
        ));
    }
    out.push_str("];\n");

    std::fs::write(out_dir.join("images.rs"), out)
        .expect("cannot write the image registry");

    println!("cargo:rerun-if-changed={}", images_dir.display());
}
