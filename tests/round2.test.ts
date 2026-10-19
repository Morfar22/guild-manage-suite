import { safeHref } from "@/lib/safeHref";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_OPENAI_MODEL, getOpenAIModel } from "@/lib/server/openai";
import { safeEqual } from "@/lib/server/api-auth";

describe("getOpenAIModel", () => {
  const original = process.env.OPENAI_MODEL;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = original;
  });

  it("defaults to the project model gpt-6-luna", () => {
    delete process.env.OPENAI_MODEL;
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-6-luna");
    expect(getOpenAIModel()).toBe("gpt-6-luna");
  });

  it("respects an explicit OPENAI_MODEL override", () => {
    process.env.OPENAI_MODEL = "my-custom-model";
    expect(getOpenAIModel()).toBe("my-custom-model");
  });

  it("only rewrites the historical gpt-5.6-luna typo", () => {
    process.env.OPENAI_MODEL = "gpt-5.6-luna";
    expect(getOpenAIModel()).toBe("gpt-6-luna");
  });
});

describe("safeEqual", () => {
  it("compares secrets without accepting empty or missing values", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual(null, "abc")).toBe(false);
    expect(safeEqual("abc", undefined)).toBe(false);
    expect(safeEqual("æøå", "æøå")).toBe(true);
  });
});

describe("safeHref", () => {
  it("allows http(s)/mailto and blocks script-capable schemes", () => {
    expect(safeHref("https://discord.com/x")).toBe("https://discord.com/x");
    expect(safeHref("mailto:a@b.dk")).toBe("mailto:a@b.dk");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref(" JavaScript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>")).toBeUndefined();
    expect(safeHref("not a url")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });
});

describe("tebex webhook signature", () => {
  it("matches the documented sha256 -> hmac-sha256 scheme", async () => {
    const { createHash, createHmac } = await import("node:crypto");
    const { computeTebexSignature, verifyTebexSignature } =
      await import("@/lib/server/tebex-signature");
    const body = '{"id":"x","type":"payment.completed","subject":{}}';
    const secret = "s3cret";
    const expected = createHmac("sha256", secret)
      .update(createHash("sha256").update(body, "utf8").digest("hex"))
      .digest("hex");
    expect(await computeTebexSignature(body, secret)).toBe(expected);
    expect(await verifyTebexSignature(body, expected, secret)).toBe(true);
    expect(await verifyTebexSignature(body + " ", expected, secret)).toBe(
      false,
    );
    expect(await verifyTebexSignature(body, expected, null)).toBe(false);
    expect(await verifyTebexSignature(body, null, secret)).toBe(false);
  });
});
