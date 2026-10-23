const http = require("node:http");

/** Local process for evaluating the dashboard without a Discord application. */
function createOfflineServer() {
  return http.createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404);
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    response.end(
      JSON.stringify({
        status: "ok",
        mode: "offline",
        discord_connected: false,
        external_integrations_enabled: false,
      }),
    );
  });
}

module.exports = { createOfflineServer };
