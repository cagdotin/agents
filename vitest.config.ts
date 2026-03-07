import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["extensions/**/__tests__/**/*.test.ts", "scripts/__tests__/**/*.test.ts"],
		alias: {
			"@mariozechner/pi-coding-agent": "./extensions/__mocks__/pi-coding-agent.ts",
			"@mariozechner/pi-tui": "./extensions/__mocks__/pi-tui.ts",
			"@mariozechner/pi-ai": "./extensions/__mocks__/pi-ai.ts",
		},
		testTimeout: 10_000,
		hookTimeout: 10_000,
	},
});
