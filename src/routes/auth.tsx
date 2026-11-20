import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Hono } from "hono";
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_DURATION_MS,
  OAUTH_SWITCH_COOKIE_NAME,
  OAUTH_SWITCH_MAX_ATTEMPTS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  createOAuthState,
  createSession,
  isOAuthErrorCode,
  readSwitchCount,
  verifyOAuthState,
} from "../auth";
import type { OAuthErrorCode } from "../auth";
import {
  exchangeGithubCode,
  fetchGithubLogin,
  githubAuthorizeUrl,
  githubOAuthConfig,
  isAllowedLogin,
} from "../github-oauth";
import type { GithubOAuthConfig, GithubOAuthEnv } from "../github-oauth";
import { LoginPage, safeNextPath } from "../components/LoginPage";

type AuthEnv = {
  Bindings: GithubOAuthEnv & {
    SESSION_SECRET?: string;
  };
};

function cookieOptions(url: URL, expires: Date) {
  return {
    httpOnly: true,
    sameSite: "Lax",
    // http（LAN 検証）では Secure を付けない。付けると Cookie 自体が保存されない。
    secure: url.protocol === "https:",
    path: "/",
    expires,
  } as const;
}

/**
 * OAuth 用 Cookie を確実に消す。属性違いで残った Cookie が次回のログインを
 * 妨げないよう、Secure 有無の両方で削除する。
 */
function clearOAuthCookies<T extends AuthEnv>(c: Context<T>): void {
  for (const name of [
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_NEXT_COOKIE_NAME,
    OAUTH_SWITCH_COOKIE_NAME,
  ]) {
    deleteCookie(c, name, { path: "/" });
    deleteCookie(c, name, { path: "/", secure: true, sameSite: "Lax" });
  }
}

function failure<T extends AuthEnv>(c: Context<T>, code: OAuthErrorCode): Response {
  clearOAuthCookies(c);
  return c.redirect(`/login?error=${code}`);
}

function callbackUrl(url: string): string {
  return new URL("/auth/github/callback", url).toString();
}

function registerLoginRoutes<T extends AuthEnv>(app: Hono<T>) {
  app.get("/login", (c) => {
    const next = c.req.query("next");
    const errorQuery = c.req.query("error");
    const error = errorQuery !== undefined && isOAuthErrorCode(errorQuery) ? errorQuery : null;
    if (next === undefined) {
      return c.html(<LoginPage error={error} />);
    }
    return c.html(<LoginPage error={error} next={next} />);
  });
}

async function completeGithubLogin<T extends AuthEnv>(
  c: Context<T>,
  config: GithubOAuthConfig,
  secret: string,
): Promise<Response> {
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE_NAME);
  const next = safeNextPath(getCookie(c, OAUTH_NEXT_COOKIE_NAME));

  const state = c.req.query("state");
  const code = c.req.query("code");
  if (code === undefined || code === "") return failure(c, "denied");
  if (state === undefined || state === "") return failure(c, "state_missing");

  const verified = await verifyOAuthState(secret, state);
  if (!verified.ok) {
    return failure(c, verified.reason === "expired" ? "state_expired" : "state_mismatch");
  }
  // Cookie は「あれば一致を確認」する二段構え。無くても署名検証で通す。
  if (expectedState !== undefined && expectedState !== state) {
    return failure(c, "state_mismatch");
  }

  const accessToken = await exchangeGithubCode(config, code, callbackUrl(c.req.url));
  if (accessToken === null) {
    return failure(c, "exchange_failed");
  }

  const login = await fetchGithubLogin(config, accessToken);
  if (login === null) {
    return failure(c, "exchange_failed");
  }
  if (!isAllowedLogin(login, config.allowedLogin)) {
    return failure(c, "not_allowed");
  }

  clearOAuthCookies(c);
  const expires = Date.now() + SESSION_DURATION_MS;
  const session = await createSession(secret, expires);
  setCookie(
    c,
    SESSION_COOKIE_NAME,
    session,
    cookieOptions(new URL(c.req.url), new Date(expires)),
  );
  return c.redirect(next);
}

function registerGithubRoutes<T extends AuthEnv>(app: Hono<T>) {
  app.get("/auth/github", async (c) => {
    const config = githubOAuthConfig(c.env);
    if (config === null) {
      return c.text("Authentication is not configured", 503);
    }

    const url = new URL(c.req.url);
    const secret = c.env.SESSION_SECRET;
    if (secret === undefined) {
      return c.text("Authentication is not configured", 503);
    }
    const expiresAt = Date.now() + OAUTH_STATE_DURATION_MS;
    const state = await createOAuthState(secret, expiresAt, crypto.randomUUID());
    const expires = new Date(expiresAt);

    // 許可されないアカウントで詰まったときの「別のアカウントでサインイン」。
    // 同じアカウントを選び続ける無限ループを避けるため回数に上限を置く。
    let selectAccount = false;
    if (c.req.query("switch") === "1") {
      const attempts = readSwitchCount(getCookie(c, OAUTH_SWITCH_COOKIE_NAME));
      if (attempts >= OAUTH_SWITCH_MAX_ATTEMPTS) return failure(c, "switch_exhausted");
      selectAccount = true;
      setCookie(c, OAUTH_SWITCH_COOKIE_NAME, String(attempts + 1), cookieOptions(url, expires));
    }
    // Cookie は補助（無くても署名検証で成立する）。
    setCookie(c, OAUTH_STATE_COOKIE_NAME, state, cookieOptions(url, expires));
    setCookie(
      c,
      OAUTH_NEXT_COOKIE_NAME,
      safeNextPath(c.req.query("next")),
      cookieOptions(url, expires),
    );
    return c.redirect(
      githubAuthorizeUrl(config, callbackUrl(c.req.url), state, { selectAccount }),
    );
  });

  app.get("/auth/github/callback", async (c) => {
    const config = githubOAuthConfig(c.env);
    const secret = c.env.SESSION_SECRET;
    if (config === null || secret === undefined) {
      return c.text("Authentication is not configured", 503);
    }
    return completeGithubLogin(c, config, secret);
  });
}

function registerResetRoute<T extends AuthEnv>(app: Hono<T>) {
  // 失敗が後引きしたときの復旧手段。ブラウザ側でこのオリジンの Cookie を破棄する。
  app.post("/auth/reset", (c) => {
    c.header("Clear-Site-Data", '"cookies"');
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/", secure: true, sameSite: "Lax" });
    clearOAuthCookies(c);
    return c.redirect("/login");
  });
}

function registerLogoutRoute<T extends AuthEnv>(app: Hono<T>) {
  app.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.redirect("/login");
  });
}

export function registerAuthRoutes<T extends AuthEnv>(app: Hono<T>) {
  registerLoginRoutes(app);
  registerGithubRoutes(app);
  registerResetRoute(app);
  registerLogoutRoute(app);
}
