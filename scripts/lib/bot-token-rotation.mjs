import {
  decryptBotToken,
  encryptBotToken,
} from "../../src/lib/server/bot-token-crypto.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const literal = (value) =>
  value == null ? "NULL" : "'" + String(value).replaceAll("'", "''") + "'";

// Only ciphertext enters the generated SQL. The old key is never accepted for
// API authentication by this utility or written into the migration artifact.
export async function prepareBotTokenRotation(
  rows,
  oldSecret,
  nextSecret,
  verifyToken,
) {
  if (
    !oldSecret ||
    oldSecret === "default-encryption-key" ||
    !nextSecret ||
    Buffer.byteLength(nextSecret) < 32 ||
    oldSecret === nextSecret
  ) {
    throw new Error(
      "Distinct configured keys and a strong replacement key are required",
    );
  }
  const ids = new Set();
  const changes = [];
  for (const row of rows) {
    if (!uuid.test(row.id) || ids.has(row.id))
      throw new Error("Invalid or duplicate bot setting ID");
    ids.add(row.id);
    if (!row.bot_token_encrypted)
      throw new Error("Snapshot must contain only nonempty token rows");
    const token = decryptBotToken(row.bot_token_encrypted, oldSecret);
    // XOR has no integrity protection. Verify every legacy value before writing
    // any changes; a wrong key must never silently destroy saved credentials.
    if (!row.bot_token_encrypted.startsWith("v1.")) {
      if (!verifyToken || !(await verifyToken(token, row))) {
        throw new Error(
          "Legacy bot token verification failed; no rotation prepared",
        );
      }
    }
    const encrypted = encryptBotToken(token, nextSecret);
    if (decryptBotToken(encrypted, nextSecret) !== token)
      throw new Error("Encryption verification failed");
    changes.push({
      id: row.id,
      old: row.bot_token_encrypted,
      next: encrypted,
      clientId: row.bot_client_id ?? null,
    });
  }
  if (!changes.length) throw new Error("No saved bot tokens to rotate");
  const sqlFor = (rollback) => {
    const body = [
      "BEGIN",
      `IF (SELECT count(*) FROM public.guild_bot_settings WHERE bot_token_encrypted IS NOT NULL AND bot_token_encrypted <> '') <> ${changes.length} THEN RAISE EXCEPTION 'Bot settings snapshot changed'; END IF;`,
      ...changes.flatMap((row) => [
        `UPDATE public.guild_bot_settings SET bot_token_encrypted = ${literal(rollback ? row.old : row.next)} WHERE id = ${literal(row.id)}::uuid AND bot_token_encrypted = ${literal(rollback ? row.next : row.old)} AND bot_client_id IS NOT DISTINCT FROM ${literal(row.clientId)};`,
        "IF NOT FOUND THEN RAISE EXCEPTION 'Bot setting changed during rotation'; END IF;",
      ]),
      "END",
    ].join("\n");
    // Quote the entire DO body as a SQL string too. A value containing a dollar
    // delimiter must not be able to terminate the procedural block.
    return [
      "BEGIN;",
      "SET LOCAL lock_timeout = '10s';",
      "SET LOCAL statement_timeout = '30s';",
      "LOCK TABLE public.guild_bot_settings IN SHARE ROW EXCLUSIVE MODE;",
      `DO ${literal(body)};`,
      "COMMIT;",
      "",
    ].join("\n");
  };
  return {
    count: changes.length,
    applySql: sqlFor(false),
    rollbackSql: sqlFor(true),
  };
}
