// Single source for the user-facing brand name.
// docs/components/index.html mirrors this value manually (static file).
export const BRAND_NAME = "Task Matrix";

// Up-right arrow on a brand-green rounded tile for tab-bar contrast.
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="7" fill="#1f883d"/>' +
  '<path d="M6.232 22.232 L9.768 25.768 L20.768 14.768 L22 16 L24 8 L16 10 L17.232 11.232 Z" fill="#1b1f24" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke"/>' +
  "</svg>";

export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
