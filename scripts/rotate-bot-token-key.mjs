import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { prepareBotTokenRotation } from "./lib/bot-token-rotation.mjs";

// Preparation only: perform the coordinated API/runtime key switch separately.
// Keys are read from private files, never command arguments or console output.
const [snapshot, oldKeyFile, nextKeyFile, outputDirectory] =
  process.argv.slice(2);
if (!snapshot || !oldKeyFile || !nextKeyFile || !outputDirectory) {
  throw new Error(
    "Usage: rotate-bot-token-key.mjs SNAPSHOT OLD_KEY_FILE NEXT_KEY_FILE PRIVATE_OUTPUT_DIR",
  );
}
const rows = JSON.parse(await readFile(resolve(snapshot), "utf8"));
const result = await prepareBotTokenRotation(
  rows,
  (await readFile(resolve(oldKeyFile), "utf8")).trim(),
  (await readFile(resolve(nextKeyFile), "utf8")).trim(),
  async (token, row) => {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return false;
    const identity = await response.json();
    return (
      identity.bot === true &&
      (!row.bot_client_id || identity.id === row.bot_client_id)
    );
  },
);
await mkdir(resolve(outputDirectory), { recursive: true, mode: 0o700 });
await writeFile(join(resolve(outputDirectory), "apply.sql"), result.applySql, {
  mode: 0o600,
  flag: "wx",
});
await writeFile(
  join(resolve(outputDirectory), "rollback.sql"),
  result.rollbackSql,
  { mode: 0o600, flag: "wx" },
);
console.log(
  JSON.stringify({
    prepared: true,
    verifiedTokens: result.count,
    applied: false,
  }),
);
