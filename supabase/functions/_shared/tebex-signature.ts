/**
 * Tebex webhook signature check (docs.tebex.io/developers/webhooks/overview):
 * X-Signature = HMAC-SHA256(key = webhook secret, data = hex(SHA256(raw body))).
 * Uses WebCrypto so it runs in Workers, Node and Deno.
 */
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function computeTebexSignature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const bodyHash = toHex(
    await crypto.subtle.digest("SHA-256", enc.encode(rawBody)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(bodyHash)));
}

export async function verifyTebexSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const expected = await computeTebexSignature(rawBody, secret);
  const a = expected;
  const b = signature.trim().toLowerCase();
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
