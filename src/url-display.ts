const PUNYCODE_PREFIX = "xn--";
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function decodeDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint <= 0x39) return codePoint - 0x30 + 26;
  if (codePoint >= 0x61 && codePoint <= 0x7a) return codePoint - 0x61;
  if (codePoint >= 0x41 && codePoint <= 0x5a) return codePoint - 0x41;
  return -1;
}

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let value = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  value += Math.floor(value / numPoints);
  let k = 0;
  while (value > ((BASE - TMIN) * TMAX) >> 1) {
    value = Math.floor(value / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * value) / (value + SKEW));
}

function thresholdAt(k: number, bias: number): number {
  if (k <= bias) return TMIN;
  if (k >= bias + TMAX) return TMAX;
  return k - bias;
}

type DigitScan = { value: number; position: number };

/** Scans one variable-length integer; returns null when the input ends or a digit is invalid. */
function scanDigits(input: string, position: number, initial: number, bias: number): DigitScan | null {
  let value = initial;
  let weight = 1;
  for (let k = BASE; ; k += BASE) {
    if (position >= input.length) return null;
    const digit = decodeDigit(input.charCodeAt(position));
    position += 1;
    if (digit < 0) return null;
    value += digit * weight;
    if (!Number.isSafeInteger(value)) return null;
    if (digit < thresholdAt(k, bias)) return { value, position };
    weight *= BASE - thresholdAt(k, bias);
    if (!Number.isSafeInteger(weight)) return null;
  }
}

/** Decodes one punycode label (RFC 3492); returns null when the label is not valid punycode. */
export function decodePunycodeLabel(label: string): string | null {
  if (!label.toLowerCase().startsWith(PUNYCODE_PREFIX)) return null;
  const input = label.slice(PUNYCODE_PREFIX.length);
  if (input === "") return null;
  const output: number[] = [];
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  let position = 0;
  const lastDelimiter = input.lastIndexOf("-");
  if (lastDelimiter > 0) {
    for (let index = 0; index < lastDelimiter; index += 1) output.push(input.charCodeAt(index));
    position = lastDelimiter + 1;
  }
  while (position < input.length) {
    const oldI = i;
    const scan = scanDigits(input, position, i, bias);
    if (scan === null) return null;
    i = scan.value;
    position = scan.position;
    const points = output.length + 1;
    bias = adapt(i - oldI, points, oldI === 0);
    n += Math.floor(i / points);
    i %= points;
    if (n < 0x20 || n > 0x10ffff) return null;
    output.splice(i, 0, n);
    i += 1;
  }
  try {
    return String.fromCodePoint(...output);
  } catch {
    return null;
  }
}

/** Decodes each punycode label of a hostname for display; other labels stay as-is. */
export function displayHostname(hostname: string): string {
  return hostname
    .split(".")
    .map((label) => decodePunycodeLabel(label) ?? label)
    .join(".");
}

/**
 * Decodes a URL for display only: percent-encoding in the path/query/fragment and
 * punycode in the hostname become readable text. Malformed input is returned as-is.
 * Keep the original string for href so navigation keeps working.
 */
export function displayUrl(raw: string): string {
  let decoded: string;
  try {
    decoded = decodeURI(raw);
  } catch {
    return raw;
  }
  const schemeEnd = decoded.indexOf("://");
  if (schemeEnd <= 0) return decoded;
  const prefix = decoded.slice(0, schemeEnd + 3);
  if (!/^https?$/i.test(decoded.slice(0, schemeEnd))) return decoded;
  const afterScheme = decoded.slice(schemeEnd + 3);
  const hostEnd = afterScheme.search(/[/?#]/);
  if (hostEnd === -1) return `${prefix}${displayHostname(afterScheme)}`;
  return `${prefix}${displayHostname(afterScheme.slice(0, hostEnd))}${afterScheme.slice(hostEnd)}`;
}
