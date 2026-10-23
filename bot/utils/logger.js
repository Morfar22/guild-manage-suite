"use strict";

const pino = require("pino");

const sink = pino({
  serializers: { err: (value) => value },
  name: "guildos-bot",
  level: process.env.LOG_LEVEL || "info",
  redact: ["token", "password", "secret", "authorization"],
});

function redact(value) {
  let text = value.replace(/((?:Bearer|Bot)\s+)[^\s,;]+/gi, "$1[REDACTED]");
  for (const [key, secret] of Object.entries(process.env)) {
    if (/(TOKEN|SECRET|PASSWORD|SERVICE_ROLE_KEY|API_KEY)$/.test(key) && secret && secret.length >= 8)
      text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

module.exports = {
  error(...values) {
    const error = values.find((value) => value instanceof Error);
    sink.error(
      error ? { err: { type: error.name, message: redact(error.message), stack: error.stack && redact(error.stack) } } : {},
      values.map((value) => redact(value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value) || String(value))).join(" "),
    );
  },
  info: sink.info.bind(sink),
  warn: sink.warn.bind(sink),
};
