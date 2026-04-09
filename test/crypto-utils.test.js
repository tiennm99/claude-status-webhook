import { describe, it, expect } from "vitest";
import { timingSafeEqual } from "../src/crypto-utils.js";

describe("timingSafeEqual", () => {
  it("returns true for identical strings", async () => {
    expect(await timingSafeEqual("secret123", "secret123")).toBe(true);
  });

  it("returns false for different strings", async () => {
    expect(await timingSafeEqual("secret123", "wrong")).toBe(false);
  });

  it("returns false for empty vs non-empty", async () => {
    expect(await timingSafeEqual("", "something")).toBe(false);
  });

  it("returns true for both empty", async () => {
    expect(await timingSafeEqual("", "")).toBe(true);
  });
});
