use fernbox_core::{init_v8, DirectNet, ExecutionParams, InstanceSeed, NetPolicy, Vm, VmOutcome};
use std::time::Duration;
fn main() {
    init_v8();
    let params = ExecutionParams { memory_limit_mb: 128, deadline: Duration::from_secs(5) };
    let mut vm = Vm::new(&params, &InstanceSeed::embedded("base").unwrap(), Box::new(DirectNet(NetPolicy::default()))).unwrap();
    let src = std::fs::read_to_string("/tmp/dbg_isolate.js").unwrap();
    println!("{:?}", vm.run(&src, &params));
}
