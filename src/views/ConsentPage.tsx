import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME, FAVICON_HREF } from "../brand";

function scopeLabel(scope: string): string {
  return scope === "write" ? "タスクの作成・更新・削除（削除を含む）" : "タスクの閲覧";
}

/** Consent screen shown before an MCP client is granted access. */
export function ConsentPage({
  clientName,
  scopes,
  params,
}: {
  clientName: string;
  scopes: readonly string[];
  params: Record<string, string>;
}): JSX.Element {
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
            <h2>連携の許可</h2>
            <p>
              <strong>{clientName}</strong> がこのアプリへのアクセスを要求しています。
            </p>
            <ul class="scope-list">
              {scopes.map((scope) => (
                <li key={scope}>{scopeLabel(scope)}</li>
              ))}
            </ul>
            <form method="post" action="/oauth/authorize">
              {Object.entries(params).map(([key, value]) => (
                <input type="hidden" name={key} value={value} key={key} />
              ))}
              <button class="button primary" type="submit" name="decision" value="allow">
                許可
              </button>
              <button class="button" type="submit" name="decision" value="deny">
                拒否
              </button>
            </form>
          </div>
        </main>
      </body>
    </html>
  );
}
