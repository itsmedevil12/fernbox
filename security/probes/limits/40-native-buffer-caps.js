// @title Native output buffers are bounded (stdio flood)
// @flags --deadline-ms 15000
// @finding FBX-006
const kit = require("/lib/kit.js");

kit.bufferCapSuite({ known: "FBX-006" });
kit.done();
