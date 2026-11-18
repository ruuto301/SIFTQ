import { describe, expect, it } from "vite-plus/test";
import { decodePunycodeLabel, displayHostname, displayUrl } from "../src/url-display";

describe("displayUrl", () => {
  it("decodes Japanese in the path, query and fragment", () => {
    expect(
      displayUrl("https://example.com/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B?q=%E6%97%A5%E6%9C%AC%E8%AA%9E#%E8%A8%AD%E5%AE%9A"),
    ).toBe("https://example.com/問い合わせ?q=日本語#設定");
  });

  it("keeps the raw value when percent-encoding is malformed", () => {
    expect(displayUrl("https://example.com/50%OFF")).toBe("https://example.com/50%OFF");
  });

  it("decodes internationalized domains", () => {
    expect(displayUrl("https://xn--r8jz45g.jp/%E6%A4%9C%E7%B4%A2")).toBe("https://例え.jp/検索");
  });

  it("leaves plain URLs unchanged", () => {
    expect(displayUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(displayUrl("http://localhost:8787/tasks?status=do")).toBe("http://localhost:8787/tasks?status=do");
  });
});

describe("displayHostname", () => {
  it("decodes punycode labels and keeps the other labels", () => {
    expect(displayHostname("xn--r8jz45g.jp")).toBe("例え.jp");
    expect(displayHostname("example.com")).toBe("example.com");
  });

  it("keeps an invalid punycode label as-is", () => {
    expect(displayHostname("xn--zzzz.example")).toBe("xn--zzzz.example");
  });
});

describe("decodePunycodeLabel", () => {
  it("returns null for labels without the punycode prefix", () => {
    expect(decodePunycodeLabel("example")).toBeNull();
    expect(decodePunycodeLabel("xn--")).toBeNull();
  });
});
