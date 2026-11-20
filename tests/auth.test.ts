import { describe, expect, it } from "vite-plus/test";
import {
  OAUTH_ERROR_CODES,
  OAUTH_STATE_DURATION_MS,
  createOAuthState,
  createSession,
  isOAuthErrorCode,
  isValidSession,
  verifyOAuthState,
} from "../src/auth";

describe("session signing", () => {
  it("accepts a session signed with the same secret", async () => {
    const session = await createSession("secret", Date.now() + 60_000);

    expect(await isValidSession("secret", session)).toBe(true);
  });

  it("rejects a session signed with a different secret", async () => {
    const session = await createSession("secret-a", Date.now() + 60_000);

    expect(await isValidSession("secret-b", session)).toBe(false);
  });

  it("rejects an expired session", async () => {
    const session = await createSession("secret", Date.now() - 1_000);

    expect(await isValidSession("secret", session)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const session = await createSession("secret", Date.now() + 60_000);
    const tampered = session.slice(0, -1) + (session.endsWith("a") ? "b" : "a");

    expect(await isValidSession("secret", tampered)).toBe(false);
  });
});

describe("OAuth state (BDD-TM-056)", () => {
  const secret = "state-secret";
  const future = () => Date.now() + 60 * 60 * 1000;

  it("accepts a state signed with the same secret", async () => {
    const state = await createOAuthState(secret, future(), "nonce-1");

    expect(await verifyOAuthState(secret, state)).toEqual({ ok: true });
  });

  it("accepts a state even when the browser dropped the cookie (no cookie needed)", async () => {
    // Cookie が保存されない環境でも署名検証だけで成立することを表す。
    const state = await createOAuthState(secret, future(), "nonce-2");

    expect(await verifyOAuthState(secret, state, Date.now())).toEqual({ ok: true });
  });

  it("reports expired for a correctly signed but outdated state", async () => {
    const state = await createOAuthState(secret, Date.now() - 1_000, "nonce-3");

    expect(await verifyOAuthState(secret, state)).toEqual({ ok: false, reason: "expired" });
  });

  it("reports invalid for another secret", async () => {
    const state = await createOAuthState("other-secret", future(), "nonce-4");

    expect(await verifyOAuthState(secret, state)).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports invalid for a tampered nonce", async () => {
    const state = await createOAuthState(secret, future(), "nonce-5");
    const parts = state.split(".");
    const tampered = [parts[0], parts[1], "nonce-x", parts[3]].join(".");

    expect(await verifyOAuthState(secret, tampered)).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports invalid for malformed values", async () => {
    for (const value of ["", "v1", "v1.abc.nonce", "v2.1.nonce.sig"]) {
      expect(await verifyOAuthState(secret, value)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("keeps the state valid for 30 minutes", () => {
    expect(OAUTH_STATE_DURATION_MS).toBe(30 * 60 * 1000);
  });
});

describe("OAuth error codes (BDD-TM-056)", () => {
  it("recognises every code and rejects unknown values", () => {
    for (const code of OAUTH_ERROR_CODES) {
      expect(isOAuthErrorCode(code)).toBe(true);
    }
    expect(isOAuthErrorCode("1")).toBe(false);
    expect(isOAuthErrorCode("unknown")).toBe(false);
  });
});
