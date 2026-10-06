import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Hono } from "hono";
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_DURATION_MS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  createSession,
} from "../auth";
import {
  exchangeGithubCode,
  fetchGithubLogin,
  githubAuthorizeUrl,
  githubOAuthConfig,
  isAllowedLogin,
} from "../github-oauth";
import type { GithubOAuthEnv } from "../github-oauth";
import { LoginPage, safeNextPath } from "../components/LoginPage";

type AuthEnv = {
  Bindings: GithubOAuthEnv & {
    SESSION_SECRET?: string;
  };
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    path: "/",
    expires,
  } as const;
}

function callbackUrl(url: string): string {
  return new URL("/auth/github/callback", url).toString();
}

function registerLoginRoutes<T extends AuthEnv>(app: Hono<T>) {
  app.get("/login", (c) => {
    const next = c.req.query("next");
    if (next === undefined) {
      return c.html(<LoginPage error={c.req.query("error") === "1"} />);
    }
    return c.html(<LoginPage error={c.req.query("error") === "1"} next={next} />);
  });
}

function registerGithubRoutes<T extends AuthEnv>(app: Hono<T>) {
  app.get("/auth/github", (c) => {
    const config = githubOAuthConfig(c.env);
    if (config === null) {
      return c.text("Authentication is not configured", 503);
    }

    const state = crypto.randomUUID();
    const expires = new Date(Date.now() + OAUTH_STATE_DURATION_MS);
    setCookie(c, OAUTH_STATE_COOKIE_NAME, state, cookieOptions(expires));
    setCookie(c, OAUTH_NEXT_COOKIE_NAME, safeNextPath(c.req.query("next")), cookieOptions(expires));
    return c.redirect(githubAuthorizeUrl(config, callbackUrl(c.req.url), state));
  });

  app.get("/auth/github/callback", async (c) => {
    const config = githubOAuthConfig(c.env);
    const secret = c.env.SESSION_SECRET;
    if (config === null || secret === undefined) {
      return c.text("Authentication is not configured", 503);
    }

    const expectedState = getCookie(c, OAUTH_STATE_COOKIE_NAME);
    const next = safeNextPath(getCookie(c, OAUTH_NEXT_COOKIE_NAME));
    deleteCookie(c, OAUTH_STATE_COOKIE_NAME, { path: "/" });
    deleteCookie(c, OAUTH_NEXT_COOKIE_NAME, { path: "/" });

    const state = c.req.query("state");
    const code = c.req.query("code");
    if (state === undefined || state !== expectedState || code === undefined || code === "") {
      return c.redirect("/login?error=1");
    }

    const accessToken = await exchangeGithubCode(config, code, callbackUrl(c.req.url));
    if (accessToken === null) {
      return c.redirect("/login?error=1");
    }

    const login = await fetchGithubLogin(config, accessToken);
    if (login === null || !isAllowedLogin(login, config.allowedLogin)) {
      return c.redirect("/login?error=1");
    }

    const expires = Date.now() + SESSION_DURATION_MS;
    const session = await createSession(secret, expires);
    setCookie(c, SESSION_COOKIE_NAME, session, cookieOptions(new Date(expires)));
    return c.redirect(next);
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
  registerLogoutRoute(app);
}
