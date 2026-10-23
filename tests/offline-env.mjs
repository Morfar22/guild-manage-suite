import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

// Deliberately read only the committed fixture, never a developer's .env.local.
Object.assign(
  process.env,
  parseEnv(readFileSync(resolve(process.cwd(), ".env.test"), "utf8")),
);
process.env.NODE_ENV = "test";
globalThis.fetch = async (input) => {
  throw new Error(`Unmocked network request in offline test: ${String(input)}`);
};
