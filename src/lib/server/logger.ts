import pino from "pino";

const sink = pino({
  serializers: { err: (value: unknown) => value },
  name: "guildos-dashboard",
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "token",
    "password",
    "secret",
    "authorization",
    "req.headers.authorization",
  ],
});

function redact(value: string) {
  let text = value.replace(/((?:Bearer|Bot)\s+)[^\s,;]+/gi, "$1[REDACTED]");
  for (const [key, secret] of Object.entries(process.env)) {
    if (
      /(TOKEN|SECRET|PASSWORD|SERVICE_ROLE_KEY|API_KEY)$/.test(key) &&
      secret &&
      secret.length >= 8
    )
      text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

/** Preserve the error field and stack when migrating console.error call sites. */
export const logger = {
  error(...values: unknown[]) {
    const error = values.find((value) => value instanceof Error);
    sink.error(
      error instanceof Error
        ? {
            err: {
              type: error.name,
              message: redact(error.message),
              stack: error.stack ? redact(error.stack) : undefined,
            },
          }
        : {},
      values
        .map((value) =>
          redact(
            value instanceof Error
              ? value.message
              : typeof value === "string"
                ? value
                : (JSON.stringify(value) ?? String(value)),
          ),
        )
        .join(" "),
    );
  },
  info: sink.info.bind(sink),
  warn: sink.warn.bind(sink),
};
