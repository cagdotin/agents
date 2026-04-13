import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export type ConditionalFeatureReason = "startup" | "reload";

export interface ConditionalFeatureContext {
	cwd: string;
	reason: ConditionalFeatureReason;
}

export interface ConditionalFeatureActivationContext<TState> extends ConditionalFeatureContext {
	pi: ExtensionAPI;
	ctx: ExtensionContext;
	state: TState;
}

export interface ConditionalFeatureErrorContext extends ConditionalFeatureContext {
	feature_name: string;
	ctx: ExtensionContext;
	error: unknown;
}

export interface ConditionalFeatureSnapshot<TState> {
	state?: TState;
	active: boolean;
	detected: boolean;
	cwd?: string;
	reason?: ConditionalFeatureReason;
}

type ResourcePathResolver<TState> = string[] | ((state: TState) => string[] | undefined);
type TextResolver<TState> = string | ((state: TState) => string | undefined);

export interface ConditionalFeatureActivationMessage {
	customType: string;
	content: string;
	display?: boolean;
	details?: unknown;
}

type ActivationMessageResolver<TState> =
	| ConditionalFeatureActivationMessage
	| ((state: TState) => ConditionalFeatureActivationMessage | undefined);

export interface ConditionalFeatureDefinition<TState> {
	feature_name: string;
	detect: (context: ConditionalFeatureContext) => Promise<TState> | TState;
	should_activate: (state: TState) => boolean;
	activate?: (context: ConditionalFeatureActivationContext<TState>) => Promise<void> | void;
	should_include_skills?: (state: TState) => boolean;
	should_include_prompts?: (state: TState) => boolean;
	skill_paths?: ResourcePathResolver<TState>;
	prompt_paths?: ResourcePathResolver<TState>;
	system_prompt_hint?: TextResolver<TState>;
	activation_message?: ActivationMessageResolver<TState>;
	on_detection_error?: (context: ConditionalFeatureErrorContext) => Promise<void> | void;
}

export interface ConditionalFeatureHandle<TState> {
	get_snapshot: () => ConditionalFeatureSnapshot<TState>;
	get_state: () => TState | undefined;
	is_active: () => boolean;
	has_detected: () => boolean;
	refresh: (context: ConditionalFeatureContext) => Promise<ConditionalFeatureSnapshot<TState>>;
}

interface DetectionResult<TState> extends ConditionalFeatureSnapshot<TState> {
	cwd: string;
	reason: ConditionalFeatureReason;
}

function normalize_paths(paths: string[] | undefined): string[] | undefined {
	if (!paths || paths.length === 0) {
		return undefined;
	}

	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const raw_path of paths) {
		const path = raw_path.trim();
		if (!path || seen.has(path)) {
			continue;
		}
		seen.add(path);
		normalized.push(path);
	}

	return normalized.length > 0 ? normalized : undefined;
}

function resolve_paths<TState>(
	resolver: ResourcePathResolver<TState> | undefined,
	state: TState,
): string[] | undefined {
	if (!resolver) {
		return undefined;
	}

	const paths = typeof resolver === "function" ? resolver(state) : resolver;
	return normalize_paths(paths);
}

function resolve_text<TState>(resolver: TextResolver<TState> | undefined, state: TState): string | undefined {
	if (!resolver) {
		return undefined;
	}

	const value = typeof resolver === "function" ? resolver(state) : resolver;
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

function resolve_activation_message<TState>(
	resolver: ActivationMessageResolver<TState> | undefined,
	state: TState,
): ConditionalFeatureActivationMessage | undefined {
	if (!resolver) {
		return undefined;
	}

	const message = typeof resolver === "function" ? resolver(state) : resolver;
	if (!message) {
		return undefined;
	}

	const content = message.content.trim();
	const custom_type = message.customType.trim();
	if (!content || !custom_type) {
		return undefined;
	}

	return {
		customType: custom_type,
		content,
		display: message.display ?? true,
		details: message.details,
	};
}

function build_resource_result<TState>(
	definition: ConditionalFeatureDefinition<TState>,
	state: TState,
	active: boolean,
): {
	skillPaths?: string[];
	promptPaths?: string[];
} {
	const include_skills = definition.should_include_skills ? definition.should_include_skills(state) : active;
	const include_prompts = definition.should_include_prompts ? definition.should_include_prompts(state) : active;

	return {
		skillPaths: include_skills ? resolve_paths(definition.skill_paths, state) : undefined,
		promptPaths: include_prompts ? resolve_paths(definition.prompt_paths, state) : undefined,
	};
}

export function register_conditional_feature<TState>(
	pi: ExtensionAPI,
	definition: ConditionalFeatureDefinition<TState>,
): ConditionalFeatureHandle<TState> {
	let last_detection: DetectionResult<TState> | undefined;
	let activated = false;
	let activation_message_sent = false;

	async function evaluate(
		context: ConditionalFeatureContext,
		extension_context?: ExtensionContext,
		force = false,
	): Promise<DetectionResult<TState>> {
		if (!force && last_detection && last_detection.cwd === context.cwd && last_detection.reason === context.reason) {
			return last_detection;
		}

		try {
			const state = await definition.detect(context);
			last_detection = {
				state,
				active: definition.should_activate(state),
				detected: true,
				cwd: context.cwd,
				reason: context.reason,
			};
			return last_detection;
		} catch (error) {
			last_detection = {
				state: undefined,
				active: false,
				detected: false,
				cwd: context.cwd,
				reason: context.reason,
			};

			if (definition.on_detection_error && extension_context) {
				await definition.on_detection_error({
					feature_name: definition.feature_name,
					cwd: context.cwd,
					reason: context.reason,
					ctx: extension_context,
					error,
				});
			}

			return last_detection;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		const detection = await evaluate({ cwd: ctx.cwd, reason: "startup" }, ctx);
		if (!detection.active || !definition.activate || activated || detection.state === undefined) {
			return;
		}

		activated = true;
		await definition.activate({
			pi,
			ctx,
			state: detection.state,
			cwd: ctx.cwd,
			reason: "startup",
		});
	});

	pi.on("resources_discover", async (event, ctx) => {
		const detection = await evaluate({ cwd: event.cwd, reason: event.reason }, ctx);
		if (!detection.detected || detection.state === undefined) {
			return undefined;
		}

		const resources = build_resource_result(definition, detection.state, detection.active);
		if (!resources.skillPaths && !resources.promptPaths) {
			return undefined;
		}

		return resources;
	});

	if (definition.system_prompt_hint || definition.activation_message) {
		pi.on("before_agent_start", async (event) => {
			if (!last_detection?.detected || !last_detection.active || last_detection.state === undefined) {
				return undefined;
			}

			const hint = resolve_text(definition.system_prompt_hint, last_detection.state);
			const message = !activation_message_sent
				? resolve_activation_message(definition.activation_message, last_detection.state)
				: undefined;

			if (message) {
				activation_message_sent = true;
			}

			if (!hint && !message) {
				return undefined;
			}

			return {
				systemPrompt: hint ? `${event.systemPrompt}\n\n${hint}` : event.systemPrompt,
				message,
			};
		});
	}

	return {
		get_snapshot: () => ({
			state: last_detection?.state,
			active: last_detection?.active ?? false,
			detected: last_detection?.detected ?? false,
			cwd: last_detection?.cwd,
			reason: last_detection?.reason,
		}),
		get_state: () => last_detection?.state,
		is_active: () => last_detection?.active ?? false,
		has_detected: () => last_detection?.detected ?? false,
		refresh: async (context) => {
			const detection = await evaluate(context, undefined, true);
			return {
				state: detection.state,
				active: detection.active,
				detected: detection.detected,
				cwd: detection.cwd,
				reason: detection.reason,
			};
		},
	};
}

export const __testing__ = {
	normalize_paths,
	resolve_paths,
	build_resource_result,
};
