import type { Child, FC } from "hono/jsx";
import { BRAND_NAME, FAVICON_HREF } from "../brand";

/** Shared standalone HTML document for pages rendered outside the app layout. */
export const StandalonePage: FC<{ children?: Child }> = ({ children }) => (
  <html lang="ja">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta charset="UTF-8" />
      <title>{BRAND_NAME}</title>
      <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>{children}</body>
  </html>
);

/** Centered sign-in card shell shared by the login and consent screens. */
export const LoginCard: FC<{ children?: Child }> = ({ children }) => (
  <main class="login">
    <div class="login-card">
      <h1 class="brand">{BRAND_NAME}</h1>
      {children}
    </div>
  </main>
);
