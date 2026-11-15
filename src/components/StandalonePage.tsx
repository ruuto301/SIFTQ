import type { Child, FC } from "hono/jsx";
import { BRAND_NAME } from "../brand";
import { DocumentHead } from "./DocumentHead";

/** Shared standalone HTML document for pages rendered outside the app layout. */
export const StandalonePage: FC<{ children?: Child }> = ({ children }) => (
  <html lang="ja">
    <head>
      <DocumentHead>
        <link rel="stylesheet" href="/styles.css" />
      </DocumentHead>
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
