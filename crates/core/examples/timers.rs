// Verifies the timer API end to end.
//
// The fixture schedules timers that record their results into the virtual
// filesystem, so this driver runs it, then runs a second script that reads the
// results back. That round trip is also the check that a run with outstanding
// timers stays open until the queue drains rather than exiting with the top
// level.
use fernbox_core::{init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome};
use std::time::Duration;

fn main() {
    init_v8();
    let params = ExecutionParams {
        memory_limit_mb: 128,
        deadline: Duration::from_secs(2),
    };
    let mut vm = Vm::new(&params, &InstanceSeed::embedded("base").unwrap(), Box::new(DirectNet(NetPolicy::default()))).expect("virtual OS booted");

    let fixture = std::fs::read_to_string("fixtures/timers.js")
        .expect("fixture missing; run from the workspace root");
    match vm.run(&fixture, &params) {
        VmOutcome::Completed(value) => println!("scheduled: {value}"),
        other => panic!("the fixture did not complete: {other:?}"),
    }

    let results = vm.run(r#"fernbox.read("/tmp/timer-results.json") ?? "missing""#, &params);
    match results {
        VmOutcome::Completed(text) => {
            let failures: Vec<serde_json::Value> = serde_json::from_str(&text)
                .ok()
                .and_then(|checks: serde_json::Value| {
                    checks
                        .as_array()
                        .map(|c| c.iter().filter(|c| !c["ok"].as_bool().unwrap_or(false)).cloned().collect())
                })
                .unwrap_or_default();

            println!("{text}");
            if !failures.is_empty() {
                panic!("{} timer check(s) failed: {failures:?}", failures.len());
            }
        }
        other => panic!("the results could not be read back: {other:?}"),
    }

    // A run killed mid-drain leaves timers behind. The next run must not fire
    // them: it gets a fresh user context, and a callback bound to the dead one
    // has no business running in it. The deadline is comfortable and the timer
    // far out of reach, so the kill lands in the drain's wait rather than in
    // the script, which is the case that leaves a termination un-delivered.
    let short = ExecutionParams {
        memory_limit_mb: 128,
        deadline: Duration::from_millis(400),
    };
    match vm.run(
        r#"fernbox.setTimeout(() => fernbox.write("/tmp/leaked", "no"), 2000); "scheduled";"#,
        &short,
    ) {
        VmOutcome::TimedOut => {}
        other => panic!("the long timer should have hit the deadline: {other:?}"),
    }

    // Past the deadline and past the timer's own delay.
    std::thread::sleep(Duration::from_millis(2200));
    match vm.run(r#"fernbox.read("/tmp/leaked") ?? "clean""#, &params) {
        VmOutcome::Completed(text) if text == "clean" => {
            println!("no timer leaked across runs")
        }
        VmOutcome::Completed(text) => panic!("a timer leaked across runs: {text}"),
        other => panic!("the leak check did not complete: {other:?}"),
    }
}
