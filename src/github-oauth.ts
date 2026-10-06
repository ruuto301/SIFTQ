export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowedLogin: string;
  oauthBase: string;
  apiBase: string;
};

export const GITHUB_OAUTH_BASE_DEFAULT = "https://github.com";
export const GITHUB_API_BASE_DEFAULT = "https://api.github.com";

export type GithubOAuthEnv = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_ALLOWED_LOGIN?: string;
  GITHUB_OAUTH_BASE?: string;
  GITHUB_API_BASE?: string;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function githubOAuthConfig(env: GithubOAuthEnv): GithubOAuthConfig | null {
  const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = env;
  const { GITHUB_ALLOWED_LOGIN: allowedLogin } = env;
  if (!clientId || !clientSecret || !allowedLogin) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    allowedLogin,
    oauthBase: trimTrailingSlash(env.GITHUB_OAUTH_BASE ?? GITHUB_OAUTH_BASE_DEFAULT),
    apiBase: trimTrailingSlash(env.GITHUB_API_BASE ?? GITHUB_API_BASE_DEFAULT),
  };
}

export function githubAuthorizeUrl(
  config: GithubOAuthConfig,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(`${config.oauthBase}/login/oauth/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

export async function exchangeGithubCode(
  config: GithubOAuthConfig,
  code: string,
  redirectUri: string,
): Promise<string | null> {
  const response = await fetch(`${config.oauthBase}/login/oauth/access_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return readString(data, "access_token");
}

export async function fetchGithubLogin(
  config: GithubOAuthConfig,
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(`${config.apiBase}/user`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "siftq",
    },
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return readString(data, "login");
}

export function isAllowedLogin(login: string, allowedLogin: string): boolean {
  return login.toLowerCase() === allowedLogin.toLowerCase();
}
