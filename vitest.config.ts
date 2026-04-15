import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@/lib": path.resolve(__dirname, "lib"),
		},
	},
	test: {
		globals: true,
		include: [
			"extensions/**/__tests__/**/*.test.ts",
			"scripts/__tests__/**/*.test.ts",
			"lib/**/__tests__/**/*.test.ts",
		],
		alias: {
			"@mariozechner/pi-coding-agent": "./extensions/__mocks__/pi-coding-agent.ts",
			"@mariozechner/pi-tui": "./extensions/__mocks__/pi-tui.ts",
			"@mariozechner/pi-ai": "./extensions/__mocks__/pi-ai.ts",
		},
		testTimeout: 10_000,
		hookTimeout: 10_000,
	},
});
