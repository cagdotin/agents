import type { BeforeAgentStartEvent, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface FeatureConfig {
	enabled: boolean;
}

interface FeatureHooks<TConfig> {
	init: (ctx: ExtensionContext) => Promise<TConfig> | TConfig;
	activate: (ctx: ExtensionContext, config: TConfig) => void;
	get_skills?: (config: TConfig) => string[];
	get_prompts?: (config: TConfig) => string[];
	get_instructions?: (config: TConfig) => string;
}

export function register_conditional_feature<TConfig extends FeatureConfig>(
	pi: ExtensionAPI,
	hooks: FeatureHooks<TConfig>,
): void {
	let config: TConfig;
	let activated = false;

	const get_config = async (ctx: ExtensionContext): Promise<TConfig> => {
		// return config if already initialized.
		if (config) return config;

		config = await hooks.init(ctx);
		return config;
	};

	pi.on("session_start", async (_event, ctx) => {
		const config = await get_config(ctx);

		if (!config.enabled || activated) return;

		hooks.activate(ctx, config);
		activated = true;
	});

	pi.on("resources_discover", async (_event, ctx) => {
		const config = await get_config(ctx);

		if (!config.enabled) return;

		return {
			skillPaths: hooks.get_skills?.(config),
			promptPaths: hooks.get_prompts?.(config),
		};
	});

	pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx) => {
		const config = await get_config(ctx);

		if (!config.enabled || !hooks.get_instructions) return;

		const prompt = hooks.get_instructions(config).trim();

		if (prompt) {
			return { systemPrompt: `${event.systemPrompt}\n\n${prompt}` };
		}
	});
}
