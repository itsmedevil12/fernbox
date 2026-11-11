// The benchmark's Fastify service. express.js and koa.js expose the same
// routes and the same bodies, so the three numbers are comparable.
//
// AUTO_CLOSE_MS is how bench/run.mjs ends a run: the sandbox has no signals to
// send, so the server closes itself after the measurement window.
const Fastify = require("fastify");

const port = Number(process.env.PORT || 8093);
const closeAfter = Number(process.env.AUTO_CLOSE_MS || 0);
const app = Fastify({ logger: false });

app.get("/health", async () => ({ ok: true }));
app.get("/json", async () => ({ message: "hello world" }));
app.get("/plain", async (req, reply) => {
  reply.type("text/plain");
  return "hello world";
});
app.get("/users/:id", async (req) => ({ id: req.params.id, q: String(req.query.q || "") }));
app.post("/echo", async (req) => req.body);
app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: "not found" }));

app
  .listen({ port, host: "127.0.0.1" })
  .then(() => {
    console.log(`fastify listening on 127.0.0.1:${port}`);
    if (closeAfter > 0) setTimeout(() => app.close(), closeAfter);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
