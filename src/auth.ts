import { encodeUtf8, timingSafeEqual } from "./crypto";

export const SESSION_COOKIE_NAME = "app_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
export const OAUTH_NEXT_COOKIE_NAME = "github_oauth_next";
export const OAUTH_STATE_DURATION_MS = 30 * 60 * 1000;
export const OAUTH_STATE_VERSION = "v1";
export const OAUTH_SWITCH_COOKIE_NAME = "github_oauth_switch";
/** アカウント選択画面を出してよい回数。超えたらログアウト案内へ切り替える。 */
export const OAUTH_SWITCH_MAX_ATTEMPTS = 2;

/** GitHub ログインが失敗した理由。画面とログの両方でこの語彙を使う。 */
export const OAUTH_ERROR_CODES = [
  "state_missing",
  "state_mismatch",
  "state_expired",
  "denied",
  "exchange_failed",
  "not_allowed",
  "switch_exhausted",
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

const OAUTH_ERROR_CODE_SET = new Set<string>(OAUTH_ERROR_CODES);

export function isOAuthErrorCode(value: string): value is OAuthErrorCode {
  return OAUTH_ERROR_CODE_SET.has(value);
}

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

/**
 * base64 を URL 安全な形にする。state はクエリ文字列で往復するため、
 * `+` が空白に化ける環境でも壊れないようにする。
 */
function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 署名付きの state トークンを作る。Cookie がブロックされる環境（モバイルの
 * 強化ブラウザ等）でもログインが成立するよう、state は Cookie ではなく
 * URL パラメータで往復させる。認証情報は含めない（期限と nonce のみ）。
 */
export async function createOAuthState(
  secret: string,
  expires: number,
  nonce: string,
): Promise<string> {
  const payload = `${OAUTH_STATE_VERSION}.${expires}.${nonce}`;
  return `${payload}.${toBase64Url(await sign(secret, payload))}`;
}

export type OAuthStateResult = { ok: true } | { ok: false; reason: "expired" | "invalid" };

/** 署名付き state を検証する。署名が正しく期限切れの場合だけ `expired` を返す。 */
export async function verifyOAuthState(
  secret: string,
  state: string,
  now: number = Date.now(),
): Promise<OAuthStateResult> {
  const parts = state.split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };
  const [version, expiresText, nonce, signature] = parts;
  if (
    version === undefined ||
    expiresText === undefined ||
    nonce === undefined ||
    signature === undefined
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (version !== OAUTH_STATE_VERSION || nonce === "") return { ok: false, reason: "invalid" };

  const payload = `${version}.${expiresText}.${nonce}`;
  if (!timingSafeEqual(toBase64Url(await sign(secret, payload)), signature)) {
    return { ok: false, reason: "invalid" };
  }
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires < now) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** switch 用 Cookie の値を試行回数として読む。壊れた値は 0 として扱う。 */
export function readSwitchCount(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}
