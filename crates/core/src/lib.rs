//! FernBox core: V8 isolate execution with hard memory limits, CPU deadlines,
//! and a two-context sandbox boundary.

mod isolate;
mod net;
mod seed;
mod server;
mod timers;
mod vm;

pub use isolate::{init_v8, run_script, ExecutionParams, Limiter, Limited, Outcome};
pub use net::{gated_fetch, DirectNet, NetBackend, NetError, NetPolicy, NetRequest, NetResponse};
pub use seed::{
    available_embedded_images, embedded_image_json, validate_mount, validate_name, FsPolicy,
    InstanceSeed,
};
pub use server::{IncomingRequest, ResponseSink};
pub use vm::{Vm, VmOutcome};
