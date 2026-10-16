import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function deriveKey(secret: string) {
  if (!secret || secret === "default-encryption-key")
    throw new Error("BOT_SECRET_KEY must be configured");
  // Domain separation keeps the AES key distinct from the bot authentication secret.
  return createHash("sha256")
    .update("guildos:bot-token:v1:")
    .update(secret)
    .digest();
}

export function encryptBotToken(token: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptBotToken(encoded: string, secret: string): string {
  const key = deriveKey(secret);
  if (encoded.startsWith("v1.")) {
    const parts = encoded.split(".");
    if (parts.length !== 4) throw new Error("Invalid encrypted bot token");
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16)
      throw new Error("Invalid encrypted bot token");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
  if (encoded.includes("."))
    throw new Error("Unsupported bot token encryption version");
  // Read existing XOR values during migration; all new writes use AES-GCM.
  const text = atob(encoded);
  return Array.from(text, (char, index) =>
    String.fromCharCode(
      char.charCodeAt(0) ^ secret.charCodeAt(index % secret.length),
    ),
  ).join("");
}
