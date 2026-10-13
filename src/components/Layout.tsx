import type { FC } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME, FAVICON_HREF } from "../brand";
import { CLIENT_ASSETS } from "../client/scripts";
import { NAV_SCREENS } from "../screens";

const HTMX_SCRIPT = "https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist/htmx.min.js";

const STYLE_ASSETS = CLIENT_ASSETS.filter((asset) => asset.kind === "style");
const SCRIPT_ASSETS = CLIENT_ASSETS.filter((asset) => asset.kind === "script");

export const Layout: FC<{ active: "ideas" | "matrix" | "tasks"; children?: JSX.Element }> = ({
  active,
  children,
}) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{BRAND_NAME}</title>
      <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
      {STYLE_ASSETS.map((asset) => (
        <link rel="stylesheet" href={asset.path} key={asset.path} />
      ))}
      <script src={HTMX_SCRIPT} defer></script>
      {SCRIPT_ASSETS.map((asset) => (
        <script src={asset.path} defer key={asset.path}></script>
      ))}
    </head>
    <body>
      <header class="topbar">
        <a class="brand" href="/ideas">{BRAND_NAME}</a>
        <nav class="nav" aria-label="Primary">
          {NAV_SCREENS.map((screen) => (
            <a class={active === screen.activeKey ? "active" : undefined} href={screen.path} key={screen.path}>
              {screen.label}
            </a>
          ))}
        </nav>
        <form action="/logout" method="post" class="logout">
          <button type="submit" class="button">Logout</button>
        </form>
      </header>
      <main id="page">{children}</main>
    </body>
  </html>
);
