import { describe, expect, it } from "vite-plus/test";
import { splitDescription } from "../src/description";

describe("splitDescription links", () => {
  it("splits http and https URLs into link segments", () => {
    expect(splitDescription("Read https://example.com/docs and http://localhost:8787."))
      .toEqual([
        { text: "Read " },
        { text: "https://example.com/docs", href: "https://example.com/docs" },
        { text: " and " },
        { text: "http://localhost:8787", href: "http://localhost:8787" },
        { text: "." },
      ]);
  });

  it("does not link non-http schemes", () => {
    expect(splitDescription("javascript:alert(1) www.example.com")).toEqual([
      { text: "javascript:alert(1) www.example.com" },
    ]);
  });

  it("does not treat an image token inside a URL as an image", () => {
    expect(splitDescription("https://example.com/api/images/abc")).toEqual([
      { text: "https://example.com/api/images/abc", href: "https://example.com/api/images/abc" },
    ]);
  });

  it("does not treat an attachment token inside a URL as an image", () => {
    expect(splitDescription("https://example.com/api/attachments/abc")).toEqual([
      { text: "https://example.com/api/attachments/abc", href: "https://example.com/api/attachments/abc" },
    ]);
  });

  it("shows percent-encoded Japanese decoded while keeping the raw href", () => {
    const [segment] = splitDescription(
      "https://example.com/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B?q=%E6%97%A5%E6%9C%AC%E8%AA%9E",
    );
    expect(segment).toEqual({
      text: "https://example.com/問い合わせ?q=日本語",
      href: "https://example.com/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B?q=%E6%97%A5%E6%9C%AC%E8%AA%9E",
    });
  });

  it("keeps malformed percent-encoding as-is", () => {
    expect(splitDescription("https://example.com/50%OFF")).toEqual([
      { text: "https://example.com/50%OFF", href: "https://example.com/50%OFF" },
    ]);
  });
});

describe("splitDescription images", () => {
  it("splits image tokens into image segments", () => {
    expect(splitDescription("before /api/images/abc-123 after")).toEqual([
      { text: "before " },
      { text: "/api/images/abc-123", src: "/api/images/abc-123" },
      { text: " after" },
    ]);
  });

  it("keeps surrounding punctuation outside an image token", () => {
    expect(splitDescription("/api/images/abc-123.")).toEqual([
      { text: "/api/images/abc-123", src: "/api/images/abc-123" },
      { text: "." },
    ]);
  });

  it("splits an idea attachment token into an image segment", () => {
    expect(splitDescription("before /api/attachments/abc-123 after")).toEqual([
      { text: "before " },
      { text: "/api/attachments/abc-123", src: "/api/attachments/abc-123" },
      { text: " after" },
    ]);
  });

  it("splits a Markdown attachment image into one image segment", () => {
    expect(splitDescription("前半![](/api/attachments/abc-123)後半")).toEqual([
      { text: "前半" },
      { text: "/api/attachments/abc-123", src: "/api/attachments/abc-123" },
      { text: "後半" },
    ]);
  });

  it("splits a Markdown image with surrounding whitespace inside the parentheses", () => {
    expect(splitDescription("![]( /api/attachments/abc-123 )")).toEqual([
      { text: "/api/attachments/abc-123", src: "/api/attachments/abc-123" },
    ]);
  });
});
