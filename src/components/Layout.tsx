import type { FC } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME } from "../brand";
import { DocumentHead } from "./DocumentHead";
import { CLIENT_ASSETS } from "../client/scripts";
import { NAV_SCREENS } from "../screens";
import type { ActiveKey } from "../screens";

const HTMX_SCRIPT = "https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist/htmx.min.js";

const STYLE_ASSETS = CLIENT_ASSETS.filter((asset) => asset.kind === "style");
const SCRIPT_ASSETS = CLIENT_ASSETS.filter((asset) => asset.kind === "script");

export const Layout: FC<{ active: ActiveKey; children?: JSX.Element }> = ({
  active,
  children,
}) => (
  <html lang="ja">
    <head>
      <DocumentHead>
        {STYLE_ASSETS.map((asset) => (
          <link rel="stylesheet" href={asset.path} key={asset.path} />
        ))}
        <script src={HTMX_SCRIPT} defer></script>
        {SCRIPT_ASSETS.map((asset) => (
          <script src={asset.path} defer key={asset.path}></script>
        ))}
      </DocumentHead>
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
        <div class="topbar-actions">
          <a class="button" href="/connections">Connections</a>
          <form action="/logout" method="post" class="logout">
            <button type="submit" class="button">Logout</button>
          </form>
        </div>
      </header>
      <p id="move-error" class="error move-error" hidden>移動に失敗しました。もう一度お試しください。</p>
      <main id="page">{children}</main>
    </body>
  </html>
);
