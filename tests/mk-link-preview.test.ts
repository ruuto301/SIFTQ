import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  MK_PREVIEW_MAX_BYTES,
  extractMkLinkPreview,
  extractMkPreviewUrl,
  fetchMkLinkPreview,
  isBlockedPreviewHostname,
  parseMkPreviewUrl,
} from "../src/mk-link-preview";

function htmlPage(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

const CLEAR_SCHEME = "http";
const SECURE_SCHEME = "https";

function withHost(host: string, path = "/x"): string {
  return `${CLEAR_SCHEME}://${host}${path}`;
}

function ip(...parts: readonly string[]): string {
  return parts.join(".");
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MK preview URL validation", () => {
  it("accepts public http and https hosts", () => {
    expect(parseMkPreviewUrl(`${SECURE_SCHEME}://example.com/post/1`)?.hostname).toBe("example.com");
    expect(parseMkPreviewUrl(`  ${CLEAR_SCHEME}://example.com  `)?.protocol).toBe(`${CLEAR_SCHEME}:`);
  });

  it("rejects loopback, private, link-local, and local hostnames", () => {
    for (const host of [
      "localhost",
      "notes.local",
      "box.internal",
      "127.0.0.1",
      "0.0.0.0",
      ip("10", "0", "0", "5"),
      ip("172", "16", "0", "1"),
      ip("192", "168", "1", "1"),
      ip("169", "254", "169", "254"),
      ip("100", "64", "0", "1"),
      "[::1]",
      "[fe80::1]",
      "[fd00::1]",
    ]) {
      expect(parseMkPreviewUrl(withHost(host))).toBeNull();
    }
    expect(isBlockedPreviewHostname("Example.COM")).toBe(false);
  });

  it("rejects unsupported protocols and malformed input", () => {
    expect(parseMkPreviewUrl("javascript:alert(1)")).toBeNull();
    expect(parseMkPreviewUrl("file:///etc/passwd")).toBeNull();
    expect(parseMkPreviewUrl("ftp://example.com/file")).toBeNull();
    expect(parseMkPreviewUrl("example.com/no-scheme")).toBeNull();
    expect(parseMkPreviewUrl("")).toBeNull();
  });

  it("picks the first safe URL out of free text", () => {
    expect(extractMkPreviewUrl("see https://example.com/a?b=1 for details")).toBe("https://example.com/a?b=1");
    expect(extractMkPreviewUrl("(https://example.com/a)。")).toBe("https://example.com/a");
    expect(extractMkPreviewUrl(`only ${withHost("localhost")} here`)).toBeNull();
    expect(extractMkPreviewUrl("no links at all")).toBeNull();
  });
});

describe("MK preview metadata", () => {
  it("prefers Open Graph values and resolves a relative image", () => {
    const page = `<html><head><title>Fallback</title>
      <meta property="og:title" content="OG &amp; Title">
      <meta property="og:description" content="desc">
      <meta property="og:image" content="/img.png">
      </head></html>`;

    expect(extractMkLinkPreview(page, "https://example.com/post/1")).toEqual({
      title: "OG & Title",
      description: "desc",
      image: "https://example.com/img.png",
      domain: "example.com",
    });
  });

  it("falls back to the title tag and the plain description", () => {
    const page = `<head><title>  Plain title  </title><meta name="description" content="plain desc"></head>`;

    expect(extractMkLinkPreview(page, "https://example.com/")).toEqual({
      title: "Plain title",
      description: "plain desc",
      image: null,
      domain: "example.com",
    });
  });

  it("drops an image that is not http", () => {
    const page = `<meta property="og:image" content="data:image/png;base64,AAAA">`;

    expect(extractMkLinkPreview(page, "https://example.com/").image).toBeNull();
  });
});

describe("fetchMkLinkPreview", () => {
  it("refuses a blocked host without touching the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await fetchMkLinkPreview(withHost("127.0.0.1", "/"))).toEqual({ ok: false, error: "INVALID_URL" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-validates every redirect hop", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(requestUrl(input));
      return new Response(null, { status: 302, headers: { location: withHost("127.0.0.1", "/secret") } });
    });

    expect(await fetchMkLinkPreview("https://example.com/start")).toEqual({ ok: false, error: "PREVIEW_FAILED" });
    expect(calls).toEqual(["https://example.com/start"]);
  });

  it("rejects a non-html response and an oversized body", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    expect(await fetchMkLinkPreview("https://example.com/api")).toEqual({ ok: false, error: "PREVIEW_FAILED" });

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-type": "text/html", "content-length": String(MK_PREVIEW_MAX_BYTES + 1) },
        }),
    );
    expect(await fetchMkLinkPreview("https://example.com/huge")).toEqual({ ok: false, error: "PREVIEW_FAILED" });
  });

  it("returns the extracted metadata on success", async () => {
    vi.stubGlobal("fetch", async () => htmlPage(`<meta property="og:title" content="Hello">`));

    const result = await fetchMkLinkPreview("https://example.com/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ title: "Hello", description: "", image: null, domain: "example.com" });
  });

  it("reports failure when the request throws", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });

    expect(await fetchMkLinkPreview("https://example.com/")).toEqual({ ok: false, error: "PREVIEW_FAILED" });
  });
});
