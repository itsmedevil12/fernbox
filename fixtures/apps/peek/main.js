// A read-only probe for a committed image: it reports what the base layer holds
// under the mount the volume was frozen from, with no volume attached to shadow
// it. What it prints is exactly the state `commit` froze.
const count = fernbox.read("/data/count");
const nested = fernbox.read("/data/sub/nested");
`count=${count ?? "missing"} nested=${nested ?? "missing"}`;
