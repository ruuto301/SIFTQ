import type { Child, FC } from "hono/jsx";
import { BRAND_NAME, FAVICON_HREF } from "../brand";

/**
 * Shared document head: metadata, favicon and page assets.
 * Reading fonts are requested through the CSS font stack only, so no
 * render-blocking third-party stylesheet is fetched here.
 */
export const DocumentHead: FC<{ children?: Child }> = ({ children }) => (
  <>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{BRAND_NAME}</title>
    <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
    {children}
  </>
);
