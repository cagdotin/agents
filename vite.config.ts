import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		globals: true,
		include: [
			"extensions/**/__tests__/**/*.test.ts",
			"scripts/__tests__/**/*.test.ts",
			"lib/**/__tests__/**/*.test.ts",
		],
		alias: {
			"@earendil-works/pi-coding-agent": "./extensions/__mocks__/pi-coding-agent.ts",
			"@earendil-works/pi-tui": "./extensions/__mocks__/pi-tui.ts",
			"@earendil-works/pi-ai": "./extensions/__mocks__/pi-ai.ts",
		},
		testTimeout: 10_000,
		hookTimeout: 10_000,
	},
});
