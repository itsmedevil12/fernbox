// The benchmark's Express service. koa.js and fastify.js expose the same
// routes and the same bodies, so the three numbers are comparable.
//
// AUTO_CLOSE_MS is how bench/run.mjs ends a run: the sandbox has no signals to
// send, so the server closes itself after the measurement window.
const express = require("express");

const port = Number(process.env.PORT || 8091);
const app = express();

app.disable("x-powered-by");

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/json", (req, res) => res.json({ message: "hello world" }));
app.get("/plain", (req, res) => res.type("text/plain").send("hello world"));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id, q: String(req.query.q || "") }));
app.post("/echo", express.json(), (req, res) => res.json(req.body));
app.use((req, res) => res.status(404).json({ error: "not found" }));

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`express listening on 127.0.0.1:${port}`);
  const closeAfter = Number(process.env.AUTO_CLOSE_MS || 0);
  if (closeAfter > 0) setTimeout(() => server.close(), closeAfter);
});
