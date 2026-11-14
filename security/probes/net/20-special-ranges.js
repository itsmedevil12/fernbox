// @title SSRF: special-use IPv4/IPv6 ranges are refused (CGNAT, NAT64, 6to4, benchmarking, multicast)
// @flags --deadline-ms 70000
// @finding FBX-007
const kit = require("/lib/kit.js");

kit.ssrfSuite({ known: "FBX-007" });
kit.done();
