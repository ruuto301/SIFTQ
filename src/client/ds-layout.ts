/**
 * Pure math for the DS two-pane layout, shared by the client script and its tests.
 *
 * `ds-scripts.ts` embeds these functions with `Function.prototype.toString`, so keep
 * every one self-contained: no module-scope references and no DOM access.
 */

/** localStorage key for the persisted pane width. */
export const DS_LAYOUT_STORAGE_KEY = "ds-layout:v1";

/** Left-pane width restored by a first visit and by double-click. */
export const DS_LAYOUT_DEFAULT_LEFT = 320;

export function dsLayoutLimits(containerWidth: number): { min: number; max: number } {
  const min = 160;
  const width = Number(containerWidth);
  if (!Number.isFinite(width) || width <= 0) return { min, max: min };
  const byRatio = Math.round(width * 0.75);
  const byDetail = Math.round(width - 360);
  return { min, max: Math.max(min, Math.min(byRatio, byDetail)) };
}

export function clampDsLayoutLeft(value: number, containerWidth: number): number {
  const limits = dsLayoutLimits(containerWidth);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return limits.min;
  return Math.round(Math.min(limits.max, Math.max(limits.min, numeric)));
}

/**
 * Resolves the pane width for a container: the stored ratio wins so a smaller
 * window keeps the proportions, then the result is clamped into the free range.
 */
export function dsLayoutWidthForContainer(
  layout: { left: number; ratio: number },
  containerWidth: number,
): number {
  const width = Number(containerWidth);
  if (!Number.isFinite(width) || width <= 0) return clampDsLayoutLeft(layout.left, 0);
  if (Number.isFinite(layout.ratio) && layout.ratio > 0) {
    return clampDsLayoutLeft(layout.ratio * width, width);
  }
  return clampDsLayoutLeft(layout.left, width);
}

/** Parses the saved layout, tolerating missing, malformed and legacy px-only values. */
export function parseDsLayout(raw: string | null): { left: number; ratio: number } | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const left = "left" in parsed ? Number(parsed.left) : Number.NaN;
    const ratio = "ratio" in parsed ? Number(parsed.ratio) : Number.NaN;
    if (!Number.isFinite(left) && !Number.isFinite(ratio)) return null;
    return {
      left: Number.isFinite(left) ? left : 0,
      ratio: Number.isFinite(ratio) ? ratio : 0,
    };
  } catch {
    return null;
  }
}

export function serializeDsLayout(left: number, ratio: number): string {
  return JSON.stringify({ left: Math.round(left), ratio });
}
