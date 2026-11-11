// Runs the persistence fixture twice in one isolate, confirming the virtual fs
// in the system context survives across `run` calls.
use fernbox_core::{init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome};
use std::time::Duration;

fn main() {
    init_v8();
    let params = ExecutionParams {
        memory_limit_mb: 128,
        deadline: Duration::from_secs(2),
    };
    let mut vm = Vm::new(&params, &InstanceSeed::embedded("base").unwrap(), Box::new(DirectNet(NetPolicy::default()))).expect("virtual OS booted");

    for i in 1..=2u32 {
        let source = std::fs::read_to_string("fixtures/fs_persistence.js")
            .expect("fixture missing; run from the workspace root");
        match vm.run(&source, &params) {
            VmOutcome::Completed(value) => println!("run {i}: {value}"),
            other => panic!("run {i} did not complete: {other:?}"),
        }
    }
}
