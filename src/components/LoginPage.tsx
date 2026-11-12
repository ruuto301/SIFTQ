import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME, FAVICON_HREF } from "../brand";

export function safeNextPath(next: string | undefined): string {
  if (next !== undefined && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/ideas";
}

export function LoginPage({
  error = false,
  next,
}: {
  error?: boolean;
  next?: string;
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
            <a
              class="button primary"
              href={`/auth/github?next=${encodeURIComponent(safeNextPath(next))}`}
            >
              Sign in with GitHub
            </a>
            {error ? <p class="error">GitHub sign-in failed</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
