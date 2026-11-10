/** Server-side only. Never import from browser code. */
export class DiscordBridgeError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(
    message: string,
    status: number,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "DiscordBridgeError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function vpsDiscordRequest(
  guildSnowflake: string,
  suffix: string,
  method = "GET",
) {
  if (!/^\d{16,22}$/.test(guildSnowflake))
    throw new Error("Invalid Discord guild ID");
  if (
    !/^\/(roles|members(?:\?(?:limit=\d{1,4}&after=\d{1,22})?)?|bot-member|members\/\d{16,22}\/roles\/\d{16,22})$/.test(
      suffix,
    )
  ) {
    throw new Error("Bridge path not allowed");
  }
  const base = process.env.GUILDOS_BRIDGE_URL;
  const secret = process.env.GUILDOS_BRIDGE_SECRET;
  if (!base || !secret) throw new Error("VPS bridge is not configured");
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid VPS bridge base URL");
  }
  const [resourcePath, queryString = ""] = suffix.split("?", 2);
  url.pathname =
    url.pathname.replace(/\/$/, "") +
    "/v1/guilds/" +
    guildSnowflake +
    resourcePath;
  url.search = queryString;
  const response = await fetch(url.toString(), {
    method,
    headers: { Authorization: "Bearer " + secret },
    signal: AbortSignal.timeout(12000),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(
      "[VPS bridge] request failed",
      response.status,
      json?.code || "",
    );
    const retryAfter = Number(
      response.headers?.get("retry-after") || json?.retry_after,
    );
    throw new DiscordBridgeError(
      response.status === 401
        ? "VPS bridge authentication failed"
        : response.status === 404
          ? "Discord resource not found or bot missing from server"
          : response.status === 403
            ? "Bot lacks Discord permissions"
            : response.status === 429
              ? "Discord rate limit hit"
              : "VPS bridge request failed (" + response.status + ")",
      response.status,
      response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : null,
    );
  }
  return json?.data;
}
