// The Node-shaped surface: `require('fs')` writes and reads through the builtin,
// and a local module loads through the CommonJS wrapper. If the module system
// works, this looks like ordinary Node and not like a sandbox.
const fs = require("fs");
const greet = require("/lib/greet.js");

fs.writeFileSync("/tmp/from_require.txt", greet("module"));
const back = fs.readFileSync("/tmp/from_require.txt", "utf8");

JSON.stringify({ builtin: back, local: greet("local"), dir: __dirname });
