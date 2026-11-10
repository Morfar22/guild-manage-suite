import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("bot error logs emit JSON with error stacks and redact credentials", () => {
  const run = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const logger = require('./bot/utils/logger');
    logger.error('Request failed', new Error('Bearer very-sensitive-credential'), { password: 'private-password', token: 'private-token' });
    const cyclic = {}; cyclic.self = cyclic;
    logger.error('Circular context', cyclic, 1n);
  `,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: { ...process.env, LOG_LEVEL: "info" },
    },
  );
  assert.equal(run.status, 0, run.stderr);
  const records = run.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const record = records[0];
  assert.equal(records.length, 2);
  assert.match(records[1].msg, /Circular context/);
  assert.equal(record.level, 50);
  assert.equal(record.name, "guildos-bot");
  assert.equal(record.err.type, "Error");
  assert.match(record.err.stack, /Request|Error/);
  assert.match(record.msg, /Request failed/);
  assert.ok(!run.stdout.includes("very-sensitive-credential"));
  assert.ok(!run.stdout.includes("private-password"));
  assert.ok(!run.stdout.includes("private-token"));
  assert.ok(run.stdout.includes("[REDACTED]"));
});

test("application warning/error sinks redact data and never recurse on transport failures", () => {
  const run = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const records=[];
    const logging=require('./bot/utils/consoleLogger');
    logging.installGlobalConsoleLogger({sink:record=>{
      records.push(record);console.error('[ConsoleLogger] transport unavailable');
    }});
    console.error('BOT_SECRET_KEY=fixture-sensitive-secret');
    console.log('normal information');
    const logger=require('./bot/utils/logger');
    logger.setApplicationSink(record=>records.push(record));
    logger.error('Request failed',new Error('Bearer fixture-private-value'));
    process.stdout.write('SINK_RECORDS='+JSON.stringify(records)+'\\n');
  `,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: { ...process.env, LOG_LEVEL: "info" },
    },
  );
  assert.equal(run.status, 0, run.stderr);
  const records = JSON.parse(run.stdout.split("SINK_RECORDS=")[1].trim());
  assert.equal(records.length, 2);
  assert.equal(
    records.every((r) => r.level === "error"),
    true,
  );
  assert.equal(
    JSON.stringify(records).includes("fixture-sensitive-secret"),
    false,
  );
  assert.equal(
    JSON.stringify(records).includes("fixture-private-value"),
    false,
  );
});
