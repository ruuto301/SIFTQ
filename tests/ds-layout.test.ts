import { describe, expect, it } from "vite-plus/test";
import {
  clampDsLayoutLeft,
  dsLayoutLimits,
  dsLayoutWidthForContainer,
  parseDsLayout,
  serializeDsLayout,
} from "../src/client/ds-layout";

describe("dsLayoutLimits", () => {
  it("uses 160px as the minimum and 75% as the upper bound", () => {
    // 75% of 2000 is 1500 and wins over the 1640px the detail minimum would allow.
    expect(dsLayoutLimits(2000)).toEqual({ min: 160, max: 1500 });
  });

  it("leaves the detail pane its 360px minimum", () => {
    // 75% of 1000 would be 750, but the detail pane caps the width at 640.
    expect(dsLayoutLimits(1000)).toEqual({ min: 160, max: 640 });
    expect(dsLayoutLimits(1240)).toEqual({ min: 160, max: 880 });
  });

  it("never reports a max below the minimum on a tiny container", () => {
    expect(dsLayoutLimits(400)).toEqual({ min: 160, max: 160 });
    expect(dsLayoutLimits(0)).toEqual({ min: 160, max: 160 });
    expect(dsLayoutLimits(Number.NaN)).toEqual({ min: 160, max: 160 });
  });
});

describe("clampDsLayoutLeft", () => {
  it("clamps into the computed free range", () => {
    expect(clampDsLayoutLeft(20, 1000)).toBe(160);
    expect(clampDsLayoutLeft(500, 1000)).toBe(500);
    expect(clampDsLayoutLeft(900, 1000)).toBe(640);
  });

  it("falls back to the minimum for a non-numeric value", () => {
    expect(clampDsLayoutLeft(Number.NaN, 1000)).toBe(160);
  });
});

describe("DS layout persistence", () => {
  it("round-trips the px width and the ratio", () => {
    const raw = serializeDsLayout(500, 0.4);

    expect(parseDsLayout(raw)).toEqual({ left: 500, ratio: 0.4 });
  });

  it("tolerates missing, malformed and legacy px-only values", () => {
    expect(parseDsLayout(null)).toBeNull();
    expect(parseDsLayout("not json")).toBeNull();
    expect(parseDsLayout("null")).toBeNull();
    expect(parseDsLayout("42")).toBeNull();
    expect(parseDsLayout(JSON.stringify({ left: 260 }))).toEqual({ left: 260, ratio: 0 });
  });
});

describe("dsLayoutWidthForContainer", () => {
  it("prefers the stored ratio so a smaller window keeps the proportion", () => {
    const layout = { left: 620, ratio: 0.5 };

    expect(dsLayoutWidthForContainer(layout, 1240)).toBe(620);
    expect(dsLayoutWidthForContainer(layout, 800)).toBe(400);
  });

  it("re-clamps to the detail minimum on a much smaller container", () => {
    // 0.5 * 400 = 200, but 400 - 360 leaves only 40px, so the minimum wins.
    expect(dsLayoutWidthForContainer({ left: 620, ratio: 0.5 }, 400)).toBe(160);
  });

  it("falls back to the px value when no ratio was stored", () => {
    expect(dsLayoutWidthForContainer({ left: 260, ratio: 0 }, 1240)).toBe(260);
    expect(dsLayoutWidthForContainer({ left: 260, ratio: 0 }, 400)).toBe(160);
  });
});
