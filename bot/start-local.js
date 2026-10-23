// Offline mode must be selected before bot.js or handlers are imported: those
// modules initialize clients and timers when loaded.
require("dotenv").config();

if (process.env.BOT_OFFLINE === "false") {
  require("./bot.js");
} else {
  const { createOfflineServer } = require("./local-runtime");
  const logger = require("./utils/logger");
  const server = createOfflineServer();
  const port = Number(process.env.BOT_HEALTH_PORT || 3188);
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port, mode: "offline" }, "Local bot process is ready");
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
