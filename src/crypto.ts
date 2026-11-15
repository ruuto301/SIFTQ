const encoder = new TextEncoder();

/** Encodes a string as UTF-8 bytes for Web Crypto inputs. */
export function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(value);
}

/** Constant-time comparison for signatures and PKCE challenges. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
