// The process identity the caller supplied: env pairs and the arguments after
// the entrypoint. `argv.slice(2)` behaves the way it does under a real node.
JSON.stringify({
  env: process.env.FOO ?? "<unset>",
  empty: process.env.EMPTY ?? "<unset>",
  args: process.argv.slice(2),
  argv0: process.argv[0],
  entry: __filename,
  dir: __dirname,
  cwd: process.cwd(),
});
