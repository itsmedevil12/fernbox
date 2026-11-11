// The Node-shaped user context in one run: `require('fs')`, a local module, a
// `/bin` command run through `child_process`, and the process identity — all
// through the surface the boot bundle installs, with the completion value as the
// result.
//
// The daemon composes a base image with an app folder; this example does the
// same merge by hand, because it is the only piece of that composition the
// isolate cares about and keeping it here keeps the example self-contained.
use fernbox_core::{init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome};
use serde_json::{Map, Value};
use std::path::Path;
use std::time::Duration;

/// Read an app folder into a `{ "/posix/path": contents }` map, the shape the
/// image layers use, so `require` finds the app's own `lib/`. The prefix is
/// threaded through the recursion rather than re-derived per directory, or a
/// nested file would land at the root instead of under its parent.
fn app_files(dir: &Path) -> Result<Map<String, Value>, String> {
    fn walk(dir: &Path, prefix: &str, files: &mut Map<String, Value>) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
            let entry = entry.map_err(|e| format!("{}: {e}", dir.display()))?;
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_str().ok_or_else(|| {
                format!("{}: a name that is not utf-8", path.display())
            })?;
            let posix = if prefix.is_empty() {
                name.to_string()
            } else {
                format!("{prefix}/{name}")
            };
            if path.is_dir() {
                walk(&path, &posix, files)?;
                continue;
            }
            let contents =
                std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
            files.insert(format!("/{posix}"), Value::String(contents));
        }
        Ok(())
    }

    let mut files = Map::new();
    walk(dir, "", &mut files)?;
    Ok(files)
}

fn main() {
    let app_dir = std::env::args()
        .nth(1)
        .unwrap_or("fixtures/apps/require_fs".to_string());

    init_v8();
    let params = ExecutionParams {
        memory_limit_mb: 128,
        deadline: Duration::from_secs(5),
    };

    let mut image: Map<String, Value> = serde_json::from_str(
        fernbox_core::embedded_image_json("base").expect("the base image is bundled"),
    )
    .expect("the base image is a json map");
    image.append(&mut app_files(Path::new(&app_dir)).expect("the app folder loaded"));

    let seed = InstanceSeed {
        image: serde_json::to_string(&image).expect("the composed image serialises"),
        volumes: "[]".to_string(),
        env: vec!["FOO=bar".to_string(), "EMPTY=".to_string()],
        argv: InstanceSeed::argv_for("/main.js", &["one".to_string(), "two".to_string()]),
        entrypoint: "/main.js".to_string(),
        stdin: String::new(),
    };

    let mut vm = Vm::new(&params, &seed, Box::new(DirectNet(NetPolicy::default())))
        .expect("the virtual OS booted");

    // `/bin/ls` as a command: run through `child_process`, the only way an app
    // reaches anything in `/bin`. A required module is a library; a command is
    // executed, and its captured stdout comes back as a string.
    let source = r#"
        const fs = require("fs");
        const greet = require("/lib/greet.js");
        const { execSync } = require("child_process");

        console.log("greet:", greet("example"));
        console.log("ls /etc:", execSync("ls /etc").replace(/\n+$/, " | "));
        console.log("argv:", process.argv.slice(2).join(","));
        console.log("env.FOO:", process.env.FOO);
        console.log("has greet module:", fs.existsSync("/lib/greet.js"));

        JSON.stringify({ result: greet("example"), dir: __dirname })
    "#;

    let outcome = vm.run(source, &params);
    // Printed first, because a failure is worth more with the output that led to it.
    println!("stdout:   {}", vm.output());
    println!("stderr:   {}", vm.stderr());
    match outcome {
        VmOutcome::Completed(value) => println!("result:   {value}"),
        other => panic!("the demo did not complete: {other:?}"),
    }
}
