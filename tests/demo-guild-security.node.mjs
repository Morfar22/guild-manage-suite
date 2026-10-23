import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import ts from "typescript";

for (const file of [
  "src/routes/api/public/create-demo-guild.ts",
  "supabase/functions/create-demo-guild/index.ts",
]) {
  test(`${file}: demo identity and owner are controlled by the server`, async () => {
    let handler;
    let created;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: "fixture-user" } } }),
      },
      from(table) {
        return {
          insert(row) {
            if (table === "guilds") created = row;
            return this;
          },
          select() {
            return this;
          },
          single: async () => ({ data: { id: "fixture-guild", ...created } }),
          then(resolve, reject) {
            return Promise.resolve({ error: null }).then(resolve, reject);
          },
        };
      },
    };
    const module = { exports: {} };
    const code = ts.transpileModule(
      fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      },
    ).outputText;
    const require = (name) => {
      if (
        name.startsWith("https://deno.land/") &&
        name.endsWith("/http/server.ts")
      ) {
        return {
          serve: (callback) => {
            handler = callback;
          },
        };
      }
      if (name.includes("@supabase/supabase-js"))
        return { createClient: () => client };
      if (name === "@tanstack/react-router")
        return { createFileRoute: () => (options) => options };
      if (name === "@/lib/server/logger") return { logger: { error() {} } };
      throw Error(`Unexpected dependency: ${name}`);
    };
    const environment = new Proxy({}, { get: () => crypto.randomUUID() });
    new Function("require", "module", "exports", "process", "Deno", code)(
      require,
      module,
      module.exports,
      { env: environment },
      {
        env: { get: () => crypto.randomUUID() },
        serve: (callback) => {
          handler = callback;
        },
      },
    );
    const request = new Request(
      "https://example.invalid/api/public/create-demo-guild",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer fixture",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guild_id: "111111111111111111",
          owner_id: "another-user",
        }),
      },
    );
    const response = module.exports.Route
      ? await module.exports.Route.server.handlers.POST({ request })
      : await handler(request);
    assert.equal(response.status, 200);
    assert.match(created.guild_id, /^demo_[0-9a-f-]{36}$/);
    assert.equal(created.owner_id, "fixture-user");
  });
}
