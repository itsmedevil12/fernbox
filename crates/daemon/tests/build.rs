//! A FernBoxfile builds an image, and that image runs on its own.
//!
//! The unit tests in `crates/daemon/src/fernboxfile.rs` cover parsing and the
//! in-memory composition. This test covers the part they cannot: that the image
//! written to a state directory is the one a *later run* boots, with no app
//! folder supplying the code.
//!
//! The shape of the proof matters. The app reads its own config and loads a
//! relative module from inside the image, and the run happens against an empty
//! directory, so a file that did not make it into the image cannot be covered
//! for by the host filesystem. If the build dropped `/app/lib/helper.js` the
//! run fails visibly rather than passing on a copy left lying around.
//!
//! `ENV` is checked too. An image is a bare path→contents map and has nowhere to
//! put it, so the build records it in a sidecar beside the image; the run must
//! merge it under any `--env`, which the last case pins.

use std::path::{Path, PathBuf};
use std::process::Command;

/// A fresh state directory, unique per test and per run.
fn state_dir(prefix: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
}

fn write(path: &Path, contents: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, contents).unwrap();
}

/// Run the daemon binary and return (stdout, stderr, success).
fn daemon(state: &Path, args: &[&str]) -> (String, String, bool) {
    let output = Command::new(env!("CARGO_BIN_EXE_fernbox-daemon"))
        .arg("--state-dir")
        .arg(state)
        .args(args)
        .env("NO_COLOR", "1")
        .output()
        .expect("the daemon binary ran");
    (
        String::from_utf8_lossy(&output.stdout).to_string(),
        String::from_utf8_lossy(&output.stderr).to_string(),
        output.status.success(),
    )
}

/// A throwaway root that removes itself, including when a test fails.
///
/// The other integration tests hold their daemon in a `Drop` guard because a
/// panicking assertion skips the cleanup line at the end of the test. A build
/// fixture has the same problem, and a failing test that leaves a state
/// directory behind makes the next run's scratch state harder to trust.
struct Scratch {
    root: PathBuf,
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// A build context and a matching empty directory to run against.
fn fixture(prefix: &str) -> (Scratch, PathBuf, PathBuf, PathBuf) {
    let root = state_dir(prefix);
    let app = root.join("src-app");
    let state = root.join("state");
    let empty = root.join("empty");

    write(
        &app.join("src/main.js"),
        r#"
        const config = fernbox.read("/app/config.json");
        const helper = require("./lib/helper.js");
        `env=${process.env.NODE_ENV} cfg=${config.trim()} helper=${helper.answer}`;
        "#,
    );
    write(&app.join("src/lib/helper.js"), r#"module.exports = { answer: "from-image" };"#);
    write(&app.join("config.json"), r#"{"built":true}"#);
    write(
        &app.join("FernBoxfile"),
        "FROM base\nENV NODE_ENV=production\nCOPY ./src /app\nCOPY ./config.json /app/config.json\nCMD /app/main.js\n",
    );

    std::fs::create_dir_all(&empty).unwrap();
    (Scratch { root }, app, state, empty)
}

#[test]
fn a_built_image_runs_without_an_app_folder() {
    let (_scratch, app, state, empty) = fixture("fernbox-build-run");

    let file = app.join("FernBoxfile");
    let (out, err, ok) = daemon(&state, &["build", "-f", file.to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");
    assert!(out.contains("built image"), "expected a build summary, got: {out}");
    // The tag is derived from the context directory when none is given.
    assert!(out.contains("src-app"), "the derived tag should name the context: {out}");

    // An empty app folder: every file the script reads comes from the image.
    let (out, err, ok) = daemon(
        &state,
        &["run", empty.to_str().unwrap(), "--image", "base-src-app", "--entrypoint", "/app/main.js"],
    );
    assert!(ok, "the run failed: {err}");
    assert!(
        out.contains("cfg={\"built\":true}"),
        "the image's own config did not reach the sandbox: {out}",
    );
    assert!(
        out.contains("helper=from-image"),
        "a relative require from the image did not resolve: {out}",
    );
    assert!(
        out.contains("env=production"),
        "the build file's ENV did not reach process.env: {out}",
    );

}

#[test]
fn a_caller_env_overrides_the_images_default() {
    let (_scratch, app, state, empty) = fixture("fernbox-build-env");

    let file = app.join("FernBoxfile");
    let (_, err, ok) = daemon(&state, &["build", "-f", file.to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");

    let (out, err, ok) = daemon(
        &state,
        &[
            "run", empty.to_str().unwrap(),
            "--image", "base-src-app",
            "--entrypoint", "/app/main.js",
            "--env", "NODE_ENV=staging",
        ],
    );
    assert!(ok, "the run failed: {err}");
    // The build file records a default; an explicit flag is a deliberate
    // override and must win.
    assert!(out.contains("env=staging"), "the caller's env should win: {out}");
    assert!(!out.contains("env=production"), "the image default should be replaced: {out}");

}

#[test]
fn a_rebuild_drops_files_the_build_file_no_longer_copies() {
    // A rebuild replaces the image rather than layering onto it. Otherwise a
    // file deleted from the build file would linger, and the image would slowly
    // stop matching what its own FernBoxfile says.
    let (_scratch, app, state, empty) = fixture("fernbox-build-rebuild");

    let file = app.join("FernBoxfile");
    let (_, err, ok) = daemon(&state, &["build", "-f", file.to_str().unwrap()]);
    assert!(ok, "the first build failed: {err}");

    // The second build copies only main.js and a config, dropping lib/helper.js.
    write(
        &app.join("src/main.js"),
        r#"`only=${fernbox.fs.exists("/app/lib/helper.js")}`;"#,
    );
    write(
        &app.join("FernBoxfile"),
        "FROM base\nCOPY ./src/main.js /app/main.js\nCMD /app/main.js\n",
    );
    let (_, err, ok) = daemon(&state, &["build", "-f", file.to_str().unwrap()]);
    assert!(ok, "the rebuild failed: {err}");

    let (out, err, ok) = daemon(
        &state,
        &["run", empty.to_str().unwrap(), "--image", "base-src-app", "--entrypoint", "/app/main.js"],
    );
    assert!(ok, "the run failed: {err}");
    assert!(
        out.contains("only=false"),
        "a file from the previous build survived the rebuild: {out}",
    );

}

#[test]
fn a_bad_build_file_fails_with_a_line_number() {
    let (_scratch, app, state, _empty) = fixture("fernbox-build-bad");

    let file = app.join("FernBoxfile");
    // `ARG` is genuinely unsupported; `RUN` is not, so using it here would make
    // this test pass for the wrong reason.
    write(&file, "FROM base\nARG FOO=bar\n");
    let (_out, err, ok) = daemon(&state, &["build", "-f", file.to_str().unwrap()]);

    assert!(!ok, "an unknown keyword must fail the build");
    assert!(err.contains("line 2"), "the error should name the line: {err}");
    assert!(err.contains("ARG"), "the error should name the keyword: {err}");

}

/// A running `serve`, so the build can be driven over the socket the way the CLI
/// drives it rather than through a subcommand shortcut.
struct Serving {
    child: std::process::Child,
    port: u16,
    token: String,
}

impl Serving {
    fn start(state: &Path) -> Serving {
        std::fs::create_dir_all(state).unwrap();
        let child = Command::new(env!("CARGO_BIN_EXE_fernbox-daemon"))
            .arg("serve")
            .arg("--state-dir")
            .arg(state)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("the daemon started");

        let file = state.join("daemon.json");
        for _ in 0..200 {
            if let Ok(text) = std::fs::read_to_string(&file) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let (Some(port), Some(token)) =
                        (json["port"].as_u64(), json["token"].as_str())
                    {
                        return Serving { child, port: port as u16, token: token.to_string() };
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        panic!("the daemon never wrote daemon.json");
    }

    fn request(&self, request: &fernbox_proto::ClientRequest) -> fernbox_proto::DaemonResponse {
        use std::net::{TcpStream, ToSocketAddrs};
        let addr = ("127.0.0.1", self.port).to_socket_addrs().unwrap().next().unwrap();
        let mut stream = TcpStream::connect_timeout(&addr, std::time::Duration::from_secs(5)).unwrap();
        fernbox_proto::write_frame(
            &mut stream,
            &fernbox_proto::ClientRequest::Auth { token: self.token.clone() },
        )
        .unwrap();
        fernbox_proto::write_frame(&mut stream, request).unwrap();
        fernbox_proto::read_frame(&mut stream).unwrap().expect("a reply")
    }
}

impl Drop for Serving {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[test]
fn a_build_over_the_socket_matches_the_subcommand() {
    // The CLI sends the FernBoxfile's text and its context; this is that same
    // request without a CLI in the way. Both routes call the same build
    // function, so what this checks is the plumbing: that the text arrives, the
    // context is honoured, and the image is written where a later run finds it.
    let (_scratch, app, state, empty) = fixture("fernbox-build-socket");
    let server = Serving::start(&state);

    let file = app.join("FernBoxfile");
    let text = std::fs::read_to_string(&file).unwrap();
    let context = std::fs::canonicalize(&app).unwrap();

    let reply = server.request(&fernbox_proto::ClientRequest::Build {
        file: text,
        context: context.to_string_lossy().into_owned(),
        tag: Some("socket-app".into()),
    });
    match &reply {
        fernbox_proto::DaemonResponse::Ok { value, .. } => {
            assert!(value.contains("socket-app"), "the reply should name the image: {value}");
        }
        other => panic!("the build failed: {other:?}"),
    }

    let (out, err, ok) = daemon(
        &state,
        &["run", empty.to_str().unwrap(), "--image", "socket-app", "--entrypoint", "/app/main.js"],
    );
    assert!(ok, "the run failed: {err}");
    assert!(out.contains("helper=from-image"), "the socket build produced a broken image: {out}");

}

#[test]
fn a_build_request_cannot_copy_outside_its_context() {
    // The containment rule has to hold on the socket route too, because that is
    // the route the CLI uses and the one a FernBoxfile arrives over.
    let (_scratch, app, state, _empty) = fixture("fernbox-build-socket-escape");
    let server = Serving::start(&state);

    let reply = server.request(&fernbox_proto::ClientRequest::Build {
        file: "FROM base\nCOPY ../.. /etc\n".into(),
        context: std::fs::canonicalize(&app).unwrap().to_string_lossy().into_owned(),
        tag: Some("escape".into()),
    });
    match reply {
        fernbox_proto::DaemonResponse::Err { message } => {
            assert!(message.contains(".."), "the error should be about containment: {message}");
        }
        other => panic!("a copy outside the context was allowed: {other:?}"),
    }
    // Nothing was written: a rejected build must not leave a half-made image.
    assert!(!state.join("images/escape").exists(), "a rejected build wrote an image");

}

#[test]
fn copy_respects_gitignore_and_fernboxignore() {
    // The context is what a COPY copies, minus whatever its ignore files say is
    // not part of the project. Without this a `COPY ./ /app` drags in
    // `node_modules` and `.git`, which is both slow and enough files to blow the
    // seed budget on a real app.
    let root = state_dir("fernbox-build-ignore");
    let app = root.join("proj");
    let state = root.join("state");
    let _scratch = Scratch { root: root.clone() };

    write(&app.join("src/main.js"), "`ok`;");
    write(&app.join("src/lib/n.js"), "module.exports={v:1};");
    write(&app.join("node_modules/pkg/index.js"), "BIG DEPENDENCY TREE");
    write(&app.join(".git/HEAD"), "ref: refs/heads/main");
    write(&app.join("src/main.js.map"), "sourcemap");
    write(&app.join(".gitignore"), "node_modules/\n.git/\n*.map\n");
    write(&app.join("build.log"), "keep me, no rule matches");
    write(&app.join("FernBoxfile"), "FROM base\nCOPY ./ /app\nCMD /app/src/main.js\n");

    let (out, err, ok) = daemon(&state, &["build", "-f", app.join("FernBoxfile").to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");
    assert!(out.contains("ignore rule"), "the summary should mention the rules: {out}");

    let image = state.join("images/base-proj");
    let has = |path: &str| image.join(path).exists();

    assert!(has("app/src/main.js"), "a kept file was dropped");
    assert!(has("app/src/lib/n.js"), "a kept nested file was dropped");
    assert!(has("app/build.log"), "a file no rule matches was dropped");
    assert!(!has("app/node_modules"), "node_modules was copied");
    assert!(!has("app/.git"), ".git was copied");
    assert!(!has("app/src/main.js.map"), "a *.map pattern was not applied");
}

#[test]
fn a_fernboxignore_can_reinclude_what_gitignore_excludes() {
    let root = state_dir("fernbox-build-reinclude");
    let app = root.join("proj");
    let state = root.join("state");
    let _scratch = Scratch { root: root.clone() };

    write(&app.join("keep.txt"), "in the image");
    write(&app.join("skip.txt"), "excluded");
    write(&app.join(".gitignore"), "*.txt\n");
    write(&app.join(".fernboxignore"), "!keep.txt\n");
    write(&app.join("FernBoxfile"), "FROM base\nCOPY ./ /app\nCMD /app/keep.txt\n");

    let (_, err, ok) = daemon(&state, &["build", "-f", app.join("FernBoxfile").to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");

    let image = state.join("images/base-proj");
    assert!(image.join("app/keep.txt").exists(), "the negation did not re-include the file");
    assert!(!image.join("app/skip.txt").exists(), "the exclusion did not apply");

    // The ignore files themselves are not copied just because they were read.
    assert!(!image.join("app/.gitignore").exists(), ".gitignore was copied into the image");
}

#[test]
fn run_steps_execute_in_order_and_their_files_reach_the_image() {
    // A build step is an ordinary sandboxed run whose filesystem is the image.
    // What this pins is the layering: step 2 must see step 1's directory, and
    // both must survive into the finished image rather than living only for the
    // length of the step.
    let root = state_dir("fernbox-build-run");
    let app = root.join("proj");
    let state = root.join("state");
    let empty = root.join("empty");
    let _scratch = Scratch { root: root.clone() };
    std::fs::create_dir_all(&empty).unwrap();

    write(&app.join("main.js"), r#"fernbox.read("/etc/one.txt") + fernbox.read("/etc/two/three.txt");"#);
    write(
        &app.join("FernBoxfile"),
        "FROM base\nCOPY ./main.js /app/main.js\n\
         RUN echo one > /etc/one.txt\n\
         RUN mkdir -p /etc/two && cat /etc/one.txt > /etc/two/three.txt\n\
         CMD /app/main.js\n",
    );

    let (out, err, ok) = daemon(&state, &["build", "-f", app.join("FernBoxfile").to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");
    // Step progress is a diagnostic, so it goes to stderr with the rest of the
    // build log rather than mixing with the completion line on stdout.
    assert!(err.contains("step 1"), "the build should report its steps: {err}");
    assert!(err.contains("step 2"), "both steps should run: {err}");

    // Step 2 read step 1's file through the shell, so the second file holds the
    // same bytes. If steps did not share a filesystem this would be empty.
    let image = state.join("images/base-proj");
    assert_eq!(
        std::fs::read_to_string(image.join("etc/one.txt")).unwrap().trim(),
        "one",
    );
    assert_eq!(
        std::fs::read_to_string(image.join("etc/two/three.txt")).unwrap().trim(),
        "one",
    );
}

#[test]
fn a_failing_run_step_fails_the_build_and_writes_no_image() {
    // A half-built image is worse than none: a run against it would fail in a
    // confusing place, far from the build step that broke.
    let root = state_dir("fernbox-build-run-fail");
    let app = root.join("proj");
    let state = root.join("state");
    let _scratch = Scratch { root: root.clone() };

    write(&app.join("FernBoxfile"), "FROM base\nRUN exit 3\nCMD /app/main.js\n");

    let (_, err, ok) = daemon(&state, &["build", "-f", app.join("FernBoxfile").to_str().unwrap()]);
    assert!(!ok, "a failing step must fail the build");
    assert!(err.contains("RUN"), "the error should name the step: {err}");
    assert!(
        !state.join("images/base-proj").exists(),
        "a failed build wrote an image",
    );

    // The scratch volume a step borrows must not survive either, or repeated
    // builds would accumulate named state nobody asked for.
    let volumes = state.join("volumes");
    let leftovers = std::fs::read_dir(&volumes).map(|dir| dir.count()).unwrap_or(0);
    assert_eq!(leftovers, 0, "a build step leaked its scratch volume");
}

#[test]
fn run_sees_the_build_env() {
    // `ENV` before `RUN` is how a build step gets `NODE_ENV`, which is the whole
    // reason to declare it at build time rather than run time.
    let root = state_dir("fernbox-build-run-env");
    let app = root.join("proj");
    let state = root.join("state");
    let _scratch = Scratch { root: root.clone() };

    write(
        &app.join("FernBoxfile"),
        "FROM base\nENV BUILT_BY=fernbox\nRUN printenv BUILT_BY > /etc/built-by\nCMD /app/main.js\n",
    );

    let (_, err, ok) = daemon(&state, &["build", "-f", app.join("FernBoxfile").to_str().unwrap()]);
    assert!(ok, "the build failed: {err}");

    assert_eq!(
        std::fs::read_to_string(state.join("images/base-proj/etc/built-by")).unwrap().trim(),
        "fernbox",
        "the step did not see the build's ENV",
    );
}
