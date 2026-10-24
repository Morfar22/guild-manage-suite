import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Run the actual handlers, replacing only the transport, router and database boundaries.
export function loadHandler(
  file,
  {
    supabase,
    interval = () => {
      throw Error("Unexpected interval");
    },
    fetch: transport = async () => {
      throw Error("Unexpected network call");
    },
  } = {},
) {
  const cache = new Map();
  let edgeHandler;
  const runtimeProcess = {
    env: {
      SUPABASE_URL: "https://db.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test",
      DISCORD_BOT_TOKEN: "test-token",
      BOT_SECRET_KEY: "test-secret",
      DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-client-secret",
    },
  };
  function evaluate(filename) {
    filename = path.resolve(root, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
      fileName: filename,
    }).outputText;
    const require = (name) => {
      if (
        name.startsWith("https://deno.land/") &&
        name.endsWith("/http/server.ts")
      )
        return {
          serve: (handler) => {
            edgeHandler = handler;
          },
        };
      if (name.includes("@supabase/supabase-js"))
        return { createClient: () => supabase };
      if (name === "@tanstack/react-router")
        return { createFileRoute: () => (options) => options };
      if (name.startsWith("@/"))
        return evaluate(path.join("src", name.slice(2)) + ".ts");
      if (name.startsWith("."))
        return evaluate(path.resolve(path.dirname(filename), name));
      return nativeRequire(name);
    };
    new Function(
      "require",
      "module",
      "exports",
      "process",
      "fetch",
      "Deno",
      "setInterval",
      code,
    )(
      require,
      module,
      module.exports,
      runtimeProcess,
      transport,
      {
        env: { get: (key) => runtimeProcess.env[key] },
        serve: (handler) => {
          edgeHandler = handler;
        },
      },
      interval,
    );
    return module.exports;
  }
  const exports = evaluate(file);
  return {
    exports,
    env: runtimeProcess.env,
    call: (req) =>
      exports.Route
        ? exports.Route.server.handlers[req.method]({ request: req })
        : edgeHandler(req),
  };
}
