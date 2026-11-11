// The benchmark's Koa service. express.js and fastify.js expose the same
// routes and the same bodies, so the three numbers are comparable.
//
// AUTO_CLOSE_MS is how bench/run.mjs ends a run: the sandbox has no signals to
// send, so the server closes itself after the measurement window.
const Koa = require("koa");

const port = Number(process.env.PORT || 8092);
const app = new Koa();

function readJson(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      text += chunk;
    });
    req.on("end", () => {
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

app.use(async (ctx) => {
  const method = ctx.method;
  const path = ctx.path;

  if (method === "GET" && path === "/health") {
    ctx.body = { ok: true };
    return;
  }
  if (method === "GET" && path === "/json") {
    ctx.body = { message: "hello world" };
    return;
  }
  if (method === "GET" && path === "/plain") {
    ctx.type = "text/plain";
    ctx.body = "hello world";
    return;
  }
  const user = path.match(/^\/users\/([^/]+)$/);
  if (method === "GET" && user) {
    ctx.body = { id: decodeURIComponent(user[1]), q: String(ctx.query.q || "") };
    return;
  }
  if (method === "POST" && path === "/echo") {
    try {
      ctx.body = await readJson(ctx.req);
    } catch (err) {
      ctx.status = 400;
      ctx.body = { error: "invalid json" };
    }
    return;
  }

  ctx.status = 404;
  ctx.body = { error: "not found" };
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`koa listening on 127.0.0.1:${port}`);
  const closeAfter = Number(process.env.AUTO_CLOSE_MS || 0);
  if (closeAfter > 0) setTimeout(() => server.close(), closeAfter);
});
