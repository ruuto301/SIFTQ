import { describe, expect, it } from "vite-plus/test";
import { encodeUtf8, timingSafeEqual } from "../src/crypto";

describe("encodeUtf8", () => {
  it("encodes ASCII text as UTF-8 bytes", () => {
    expect(Array.from(encodeUtf8("abc"))).toEqual([97, 98, 99]);
  });

  it("encodes multibyte text as UTF-8 bytes", () => {
    expect(Array.from(encodeUtf8("あ"))).toEqual([227, 129, 130]);
  });
});

describe("timingSafeEqual", () => {
  it("accepts identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("rejects different values and lengths", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
