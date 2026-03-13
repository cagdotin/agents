import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { close_store } from "../core/qmd-store.js";
import type { FreshnessResult, RepoBindingResult } from "../core/types.js";
import { check_freshness } from "../domain/freshness.js";
import { detect_repo_binding } from "../domain/repo-binding.js";

const QMD_STATUS_KEY = "qmd";

export interface QmdExtensionState {
	last_binding?: RepoBindingResult;
	last_freshness?: FreshnessResult;
	init_workflow?: {
		repo_root: string;
		prompt: string;
	};
	close_panel?: () => void;
}

function footer_text(binding?: RepoBindingResult, freshness?: FreshnessResult): string | undefined {
	if (!binding || binding.status !== "indexed") {
		return undefined;
	}

	if (!freshness || freshness.status === "fresh") {
		return "qmd: indexed ✓";
	}

	if (freshness.status === "stale") {
		return `qmd: indexed · ${freshness.changed_count} stale`;
	}

	return "qmd: indexed · freshness unknown";
}

export function apply_footer_status(ctx: ExtensionContext, state: QmdExtensionState): void {
	ctx.ui.setStatus(QMD_STATUS_KEY, footer_text(state.last_binding, state.last_freshness));
}

export async function refresh_runtime_state(ctx: ExtensionContext, state: QmdExtensionState): Promise<void> {
	const binding = await detect_repo_binding(ctx.cwd);
	state.last_binding = binding;

	if (binding.status !== "indexed") {
		state.last_freshness = undefined;
		apply_footer_status(ctx, state);
		return;
	}

	state.last_freshness = binding.marker
		? await check_freshness(binding.marker)
		: { status: "unknown", reason: "No local marker found." };
	apply_footer_status(ctx, state);
}

export function register_runtime(pi: ExtensionAPI, state: QmdExtensionState): void {
	pi.on("session_start", async (_event, ctx) => {
		state.close_panel?.();
		await refresh_runtime_state(ctx, state);
	});

	pi.on("session_switch", async (_event, ctx) => {
		state.close_panel?.();
		await refresh_runtime_state(ctx, state);
	});

	for (const event_name of ["session_tree", "session_fork", "session_compact"] as const) {
		pi.on(event_name, async (_event, ctx) => {
			await refresh_runtime_state(ctx, state);
		});
	}

	pi.on("before_agent_start", async (event, _ctx) => {
		const prompt_parts: string[] = [];

		if (state.last_binding?.status === "indexed") {
			prompt_parts.push(
				"This repository is indexed by QMD.",
				`Use \`qmd query -c ${state.last_binding.collection_key} "question"\` via bash when you need conceptual search, prior decisions, or design context.`,
				"Use rg/grep for exact strings.",
				"Refer to skills/qmd/SKILL.md for the full reference.",
			);
		}

		if (state.init_workflow) {
			prompt_parts.push("", "# QMD Init Workflow", "", state.init_workflow.prompt);
		}

		if (prompt_parts.length === 0) {
			return undefined;
		}

		return {
			systemPrompt: `${event.systemPrompt}\n\n${prompt_parts.join("\n")}`,
		};
	});

	pi.on("session_shutdown", async () => {
		await close_store();
	});
}
