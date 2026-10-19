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
