import { afterEach, describe, expect, test, vi } from "vitest";
import nacl from "tweetnacl";
import {
  buildGiveawayMessagePayload,
  getGiveawayEntries,
  getGiveawayWinners,
  verifyDiscordSignature,
} from "../src/lib/server/discord-interactions-shared";

const keys = nacl.sign.keyPair();
const publicKey = Buffer.from(keys.publicKey).toString("hex");

function signedRequest(body: string, timestamp = "1760000000") {
  const signature = Buffer.from(
    nacl.sign.detached(
      new TextEncoder().encode(timestamp + body),
      keys.secretKey,
    ),
  ).toString("hex");
  return new Request("https://app.invalid/api/public/discord-interactions", {
    method: "POST",
    headers: {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    },
    body,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Discord request authentication", () => {
  test("authenticates exact bytes and rejects a changed body or key", async () => {
    const body = '{"type":1}';
    expect(
      await verifyDiscordSignature(signedRequest(body), body, publicKey),
    ).toBe(true);
    expect(
      await verifyDiscordSignature(signedRequest(body), body + " ", publicKey),
    ).toBe(false);
    const wrongKey = Buffer.from(nacl.sign.keyPair().publicKey).toString("hex");
    expect(
      await verifyDiscordSignature(signedRequest(body), body, wrongKey),
    ).toBe(false);
  });

  test("rejects absent or malformed authentication without throwing", async () => {
    const body = '{"type":1}';
    for (const headers of [
      {},
      { "X-Signature-Ed25519": "a".repeat(128) },
      { "X-Signature-Timestamp": "1" },
      { "X-Signature-Ed25519": "zz".repeat(64), "X-Signature-Timestamp": "1" },
    ]) {
      const request = new Request("https://app.invalid", { headers });
      expect(await verifyDiscordSignature(request, body, publicKey)).toBe(
        false,
      );
    }
    expect(
      await verifyDiscordSignature(signedRequest(body), body, undefined),
    ).toBe(false);
    expect(
      await verifyDiscordSignature(signedRequest(body), body, "zz".repeat(32)),
    ).toBe(false);
  });

  test("fails closed if the cryptographic provider rejects a key", async () => {
    vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(
      new Error("unsupported"),
    );
    expect(
      await verifyDiscordSignature(signedRequest("{}"), "{}", publicKey),
    ).toBe(false);
  });
});

describe("shared giveaway rendering", () => {
  const giveaway = {
    id: "giveaway-1",
    prize: "A prize",
    ends_at: "2099-01-01T00:00:00.000Z",
    winners_count: 2,
    entries: ["one", 123, "two"],
    winners: null,
  };

  test("filters stored participant values", () => {
    expect(getGiveawayEntries(giveaway.entries)).toEqual(["one", "two"]);
    expect(getGiveawayEntries({})).toEqual([]);
    expect(getGiveawayWinners(["winner", false])).toEqual(["winner"]);
    expect(getGiveawayWinners(null)).toEqual([]);
  });

  test("renders an active giveaway with a usable participation button", () => {
    const payload = buildGiveawayMessagePayload(giveaway);
    expect(payload.embeds[0].description).toBe("**A prize**");
    expect(
      payload.embeds[0].fields.find((field) => field.name.includes("Deltagere"))
        ?.value,
    ).toBe("2");
    expect(payload.components[0].components[0]).toMatchObject({
      custom_id: "giveaway_enter_giveaway-1",
      disabled: false,
      label: "Deltag (2)",
    });
  });

  test("renders role restrictions, description and winners after completion", () => {
    const payload = buildGiveawayMessagePayload({
      ...giveaway,
      ended: true,
      required_role_id: "role",
      description: "Description",
      winners: ["winner"],
    });
    expect(payload.embeds[0].description).toContain("Description");
    expect(
      payload.embeds[0].fields.some((field) => field.value === "<@&role>"),
    ).toBe(true);
    expect(
      payload.embeds[0].fields.some((field) => field.value === "<@winner>"),
    ).toBe(true);
    expect(payload.components[0].components[0].disabled).toBe(true);
  });

  test("closes expired giveaways and describes an empty result", () => {
    const payload = buildGiveawayMessagePayload({
      ...giveaway,
      ends_at: "2000-01-01T00:00:00.000Z",
    });
    expect(payload.components[0].components[0].disabled).toBe(true);
    expect(
      payload.embeds[0].fields.some(
        (field) => field.value === "Ingen gyldige deltagere.",
      ),
    ).toBe(true);
  });
});
