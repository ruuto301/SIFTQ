import { describe, expect, it } from "vite-plus/test";
import { IMAGE_MAX_BYTES, isImageContentType } from "../src/image";
import { toStoredImage } from "../src/repository/image-repository";

describe("isImageContentType", () => {
  it.each(["image/png", "image/webp", "image/jpeg"])("accepts %s", (contentType) => {
    expect(isImageContentType(contentType)).toBe(true);
  });

  it.each(["image/gif", "image/svg+xml", "text/plain", ""])("rejects %s", (contentType) => {
    expect(isImageContentType(contentType)).toBe(false);
  });

  it("allows up to one mebibyte", () => {
    expect(IMAGE_MAX_BYTES).toBe(1024 * 1024);
  });
});

describe("toStoredImage", () => {
  it("normalizes Uint8Array blobs from D1 to ArrayBuffer", () => {
    const parsed = toStoredImage({
      id: "image-1",
      owner_id: "local",
      content_type: "image/png",
      data: new Uint8Array([1, 2, 3]),
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(parsed?.data).toBeInstanceOf(ArrayBuffer);
    const bytes = parsed?.data === undefined ? [] : Array.from(new Uint8Array(parsed.data));
    expect(bytes).toEqual([1, 2, 3]);
  });

  it("accepts plain number arrays returned by the local D1 runtime", () => {
    const parsed = toStoredImage({
      id: "image-1",
      owner_id: "local",
      content_type: "image/png",
      data: [9, 8, 7],
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(parsed?.data).toBeInstanceOf(ArrayBuffer);
    const bytes = parsed?.data === undefined ? [] : Array.from(new Uint8Array(parsed.data));
    expect(bytes).toEqual([9, 8, 7]);
  });

  it("accepts ArrayBuffer blobs and rejects invalid rows", () => {
    const parsed = toStoredImage({
      id: "image-1",
      owner_id: "local",
      content_type: "image/webp",
      data: new Uint8Array([4, 5]).buffer,
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(parsed?.data).toBeInstanceOf(ArrayBuffer);
    expect(toStoredImage({ id: "image-1", data: "nope" })).toBeUndefined();
  });
});
