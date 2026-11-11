// What the caller piped in, as the whole of `process.stdin`. It reads like any
// other stream the Node-shaped surface gives an app: consumed once, then EOF.
JSON.stringify({
  first: process.stdin.readLine(),
  second: process.stdin.readLine(),
  eof: process.stdin.readLine(),
});
