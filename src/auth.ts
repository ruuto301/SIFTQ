import { encodeUtf8, timingSafeEqual } from "./crypto";

export const SESSION_COOKIE_NAME = "app_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
export const OAUTH_NEXT_COOKIE_NAME = "github_oauth_next";
export const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encodeUtf8(payload));
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(signature))));
}

export async function createSession(secret: string, expires: number): Promise<string> {
  const payload = `v1.${expires}`;
  return `${payload}.${await sign(secret, payload)}`;
}

export async function isValidSession(secret: string, value: string): Promise<boolean> {
  const separator = value.lastIndexOf(".");
  if (separator < 0) return false;

  const payload = value.slice(0, separator);
  const suppliedSignature = value.slice(separator + 1);
  if (!/^v1\.\d+$/.test(payload)) return false;

  const expires = Number(payload.slice(3));
  if (!Number.isInteger(expires) || expires < Date.now()) return false;

  const expectedSignature = await sign(secret, payload);
  return timingSafeEqual(expectedSignature, suppliedSignature);
}
