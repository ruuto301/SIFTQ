import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "app",
		compatibilityDate: "2025-06-01",
		entrypoint: "./src/index.tsx",
		env: {
			DB: bindings.d1({
				name: "siftq",
				id: "20ca1496-cadc-4b40-9265-1d59d55d5b82",
			}),
			SESSION_SECRET: bindings.secret(),
			GITHUB_CLIENT_ID: bindings.secret(),
			GITHUB_CLIENT_SECRET: bindings.secret(),
			GITHUB_ALLOWED_LOGIN: bindings.secret(),
			GITHUB_OAUTH_BASE: bindings.text(process.env["GITHUB_OAUTH_BASE"] ?? "https://github.com"),
			GITHUB_API_BASE: bindings.text(process.env["GITHUB_API_BASE"] ?? "https://api.github.com"),
			PREVIEW_MODE: bindings.text(process.env["PREVIEW_MODE"] ?? "false"),
		},
	},
});
