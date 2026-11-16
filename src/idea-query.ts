const IDEA_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A date-only bound covers the whole local day; the client sends exact ISO instants instead. */
export function normalizeIdeaDateBound(value: string, endOfDay: boolean): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (IDEA_DATE_ONLY.test(trimmed)) return `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

