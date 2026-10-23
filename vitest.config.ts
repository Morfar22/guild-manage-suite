import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  envDir: ".",
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      // Start a coverage ratchet on shared security/protocol code. This is not
      // a claim of 70% coverage across the dashboard UI or legacy route bodies.
      include: [
        "src/lib/server/api-auth.ts",
        "src/lib/server/bot-token-crypto.ts",
        "src/lib/server/guild-bot-token.ts",
        "src/lib/server/tebex-signature.ts",
        "src/lib/server/discord-oauth-security.ts",
        "src/lib/server/discord-interactions-shared.ts",
        "src/lib/server/twitch-notifications-shared.ts",
        "src/lib/server/server-clone-shared.ts",
        "src/lib/server/*schema.ts",
        "src/lib/safeHref.ts",
      ],
      thresholds: { lines: 70, branches: 60 },
    },
  },
});
