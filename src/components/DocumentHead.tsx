import type { Child, FC } from "hono/jsx";
import {
  BRAND_NAME,
  FAVICON_HREF,
  FONT_ASSET_ORIGIN,
  FONT_ORIGIN,
  FONT_STYLESHEET_HREF,
} from "../brand";

/** Shared document head: metadata, favicon, reading fonts, then page assets. */
export const DocumentHead: FC<{ children?: Child }> = ({ children }) => (
  <>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{BRAND_NAME}</title>
    <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
    <link rel="preconnect" href={FONT_ORIGIN} />
    <link rel="preconnect" href={FONT_ASSET_ORIGIN} crossorigin="anonymous" />
    <link rel="stylesheet" href={FONT_STYLESHEET_HREF} />
    {children}
  </>
);
