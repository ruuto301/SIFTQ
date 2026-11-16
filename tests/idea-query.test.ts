import { describe, expect, it } from "vite-plus/test";
import { normalizeIdeaDateBound } from "../src/idea-query";

describe("normalizeIdeaDateBound", () => {
  it("expands a date-only bound to the local day edges in UTC", () => {
    expect(normalizeIdeaDateBound("2026-01-02", false)).toBe("2026-01-02T00:00:00.000Z");
    expect(normalizeIdeaDateBound("2026-01-02", true)).toBe("2026-01-02T23:59:59.999Z");
  });

  it("keeps exact ISO instants and rejects empty or invalid input", () => {
    expect(normalizeIdeaDateBound("2026-01-02T03:04:05.000Z", false)).toBe("2026-01-02T03:04:05.000Z");
    expect(normalizeIdeaDateBound("  ", false)).toBeNull();
    expect(normalizeIdeaDateBound("not-a-date", false)).toBeNull();
  });
});
