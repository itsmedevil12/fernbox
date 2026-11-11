// A small JSON service, the shape the `http` builtin exists for: a Node-style
// `createServer` handler, a persistent hit counter on a volume, and a couple of
// routes that exercise the request and response surfaces.
//
// Run it with a granted port and a volume:
//   fernbox run fixtures/apps/http_server --publish 8080 --volume hits:/data
// then, from the host:
//   curl -X POST http://127.0.0.1:8080/hit   -> {"count":1}
//   curl http://127.0.0.1:8080/count         -> {"count":1}
//
// The port comes from PORT if the caller set it, else 8080; it must match the
// grant, because the sandbox may listen on exactly the published port and no
// other. The counter lives under /data, so it survives the run when a volume is
// mounted there.

const http = require("http");
const fs = require("fs");

const port = Number(process.env.PORT || 8080);

function readCount() {
  try {
    return Number(fs.readFileSync("/data/count", "utf8")) || 0;
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw err;
  }
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/health") {
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url === "/count") {
    return json(res, 200, { count: readCount() });
  }

  if (req.method === "POST" && url === "/hit") {
    const next = readCount() + 1;
    fs.writeFileSync("/data/count", String(next));
    return json(res, 200, { count: next });
  }

  if (req.method === "POST" && url === "/echo") {
    // The body arrives whole on `req.body`; the data/end events carry the same
    // bytes for a handler that prefers to stream them.
    return json(res, 200, { echo: req.body });
  }

  json(res, 404, { error: "not found", path: url });
});

server.listen(port, () => {
  console.log(`http_server listening on 127.0.0.1:${port}`);
});