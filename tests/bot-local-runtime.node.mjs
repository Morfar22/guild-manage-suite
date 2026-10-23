import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createOfflineServer } = require("../bot/local-runtime.js");

test("offline bot reports its actual disconnected state without provider clients", async () => {
  const server = createOfflineServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  async function get(path) {
    return new Promise((resolve, reject) => {
      http
        .get(
          { hostname: "127.0.0.1", port: server.address().port, path },
          (response) => {
            let body = "";
            response.on("data", (chunk) => (body += chunk));
            response.on("end", () =>
              resolve({ status: response.statusCode, body }),
            );
          },
        )
        .on("error", reject);
    });
  }
  try {
    const health = await get("/health");
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), {
      status: "ok",
      mode: "offline",
      discord_connected: false,
      external_integrations_enabled: false,
    });
    assert.equal((await get("/commands")).status, 404);
    assert.equal(
      Object.keys(require.cache).some((filename) =>
        filename.includes("discord.js"),
      ),
      false,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});
