import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME, FAVICON_HREF } from "../brand";
import type { OAuthErrorCode } from "../auth";

export function safeNextPath(next: string | undefined): string {
  if (next !== undefined && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/ideas";
}

/** 原因コードごとの画面文言。原因を返さないと利用者も開発者も詰まる。 */
const ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  state_missing: "ログイン情報を確認できませんでした（ブラウザの Cookie がブロックされている可能性）",
  state_mismatch: "別のタブでログインが開始されました。もう一度お試しください",
  state_expired: "ログインの有効時間（30分）が切れました",
  denied: "GitHub の認可がキャンセルされました",
  exchange_failed: "ログイン処理に失敗しました。時間をおいて再試行してください",
  not_allowed: "このアカウントでは利用できません",
  switch_exhausted:
    "アカウントを切り替えても許可されませんでした。GitHub からログアウトして、許可されたアカウントで入り直してください",
};

function errorHint(error: OAuthErrorCode): string {
  return error === "not_allowed" || error === "switch_exhausted"
    ? "GitHub のアカウントを切り替えるには、GitHub からログアウトするか、シークレットウィンドウで開いてください。"
    : "リセットは Cookie を消してやり直します。1回の失敗が次に影響しません。";
}

function ErrorActions({ error }: { error: OAuthErrorCode }): JSX.Element {
  const canSwitch = error !== "switch_exhausted";
  return (
    <>
      <div class="login-actions">
        <a class="button primary" href="/auth/github?next=%2Fideas">
          もう一度ログイン
        </a>
        {canSwitch ? (
          <a class="button" href="/auth/github?switch=1">
            別のアカウントでサインイン
          </a>
        ) : null}
        <form method="post" action="/auth/reset" class="login-reset">
          <button class="button" type="submit">
            ログインをリセット
          </button>
        </form>
      </div>
      <p class="login-hint">{errorHint(error)}</p>
      {error === "not_allowed" || error === "switch_exhausted" ? (
        <p class="login-hint">
          <a href="https://github.com/logout" target="_blank" rel="noopener noreferrer">
            GitHub からログアウト
          </a>
        </p>
      ) : null}
    </>
  );
}

export function LoginPage({
  error = null,
  next,
}: {
  error?: OAuthErrorCode | null;
  next?: string;
}): JSX.Element {
  const signInHref = `/auth/github?next=${encodeURIComponent(safeNextPath(next))}`;
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{BRAND_NAME}</title>
        <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <main class="login">
          <div class="login-card">
            <h1 class="brand">{BRAND_NAME}</h1>
            {error === null ? null : (
              <div class="login-error" role="alert">
                <p class="login-error__message">{ERROR_MESSAGES[error]}</p>
              </div>
            )}
            {error === null ? (
              <div class="login-actions">
                <a class="button primary" href={signInHref}>
                  Sign in with GitHub
                </a>
              </div>
            ) : (
              <ErrorActions error={error} />
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
