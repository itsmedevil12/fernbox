// @title Volume writes cannot escape their mount via dot-segments
// @flags --volume sec-confine:/data --deadline-ms 10000
// @finding FBX-001
// @host volume-confined sec-confine /data
const kit = require("/lib/kit.js");

kit.volumeSuite("/data", { known: "FBX-001" });
kit.done();
