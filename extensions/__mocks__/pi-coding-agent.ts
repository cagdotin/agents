// Minimal mock — only exports used in testable (Tier 1+2) modules

export function isToolCallEventType(type: string, event: { toolName?: string }): boolean {
	return event.toolName === type;
}

export function getAgentDir(): string {
	return "/tmp/mock-agent-dir";
}

export function keyHint(key: string): string {
	return `[${key}]`;
}

// Type re-exports (no-op at runtime, TypeScript handles these)
export type ToolCallEvent = {
	toolName: string;
	input: Record<string, any>;
};

export type ExtensionContext = {
	sessionManager: {
		getSessionId: () => string;
		getSessionFile: () => string;
	};
	hasUI: boolean;
	ui: {
		confirm: (title: string, message: string) => Promise<boolean>;
	};
};

export type Theme = Record<string, any>;
