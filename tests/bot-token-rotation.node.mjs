import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { prepareBotTokenRotation } from "../scripts/lib/bot-token-rotation.mjs";
import { decryptBotToken } from "../src/lib/server/bot-token-crypto.ts";

const oldKey = "old-test-key-that-is-never-a-production-secret";
const nextKey = "next-test-key-that-is-never-a-production-secret";
const token = "fixture.discord.token";
const xor = (text) =>
  btoa(
    Array.from(text, (c, i) =>
      String.fromCharCode(
        c.charCodeAt(0) ^ oldKey.charCodeAt(i % oldKey.length),
      ),
    ).join(""),
  );
const rows = [1, 2].map((i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  bot_client_id: "fixture'$bot_key_rotation$",
  bot_token_encrypted: xor(token),
}));

test("key rotation verifies legacy data, replaces every token atomically and can roll back", async () => {
  const plan = await prepareBotTokenRotation(
    rows,
    oldKey,
    nextKey,
    async (plain) => plain === token,
  );
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE public.guild_bot_settings(id uuid PRIMARY KEY, bot_client_id text, bot_token_encrypted text);",
    );
    for (const row of rows)
      await db.query(
        "INSERT INTO public.guild_bot_settings VALUES ($1,$2,$3)",
        [row.id, row.bot_client_id, row.bot_token_encrypted],
      );
    await db.exec(plan.applySql);
    const { rows: saved } = await db.query(
      "SELECT bot_token_encrypted FROM public.guild_bot_settings",
    );
    assert.equal(saved.length, 2);
    for (const row of saved) {
      assert.match(row.bot_token_encrypted, /^v1\./);
      assert.equal(decryptBotToken(row.bot_token_encrypted, nextKey), token);
      assert.throws(() => decryptBotToken(row.bot_token_encrypted, oldKey));
    }
    await db.exec(plan.rollbackSql);
    assert.deepEqual(
      (await db.query("SELECT * FROM public.guild_bot_settings ORDER BY id"))
        .rows,
      rows,
    );
    // A concurrent edit to the second row must roll back the first update too.
    await db.query(
      "UPDATE public.guild_bot_settings SET bot_token_encrypted='changed' WHERE id=$1",
      [rows[1].id],
    );
    await assert.rejects(db.exec(plan.applySql), /changed during rotation/);
    await db.exec("ROLLBACK");
    assert.equal(
      (
        await db.query(
          "SELECT bot_token_encrypted FROM public.guild_bot_settings WHERE id=$1",
          [rows[0].id],
        )
      ).rows[0].bot_token_encrypted,
      rows[0].bot_token_encrypted,
    );
  } finally {
    await db.close();
  }
});

test("key rotation refuses a wrong legacy key, duplicate rows and weak replacement keys", async () => {
  await assert.rejects(
    prepareBotTokenRotation(
      rows,
      "wrong-key",
      nextKey,
      async (plain) => plain === token,
    ),
    /verification failed/,
  );
  await assert.rejects(
    prepareBotTokenRotation(
      [...rows, rows[0]],
      oldKey,
      nextKey,
      async () => true,
    ),
    /duplicate/,
  );
  await assert.rejects(
    prepareBotTokenRotation(rows, oldKey, oldKey, async () => true),
    /Distinct/,
  );
  await assert.rejects(
    prepareBotTokenRotation(rows, oldKey, "short", async () => true),
    /strong/,
  );
});
