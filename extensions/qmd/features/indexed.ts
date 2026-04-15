import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
	type FeatureConfig,
	register_conditional_feature,
} from "../../../lib/extension-runtime/conditional-feature.js";
import type { FreshnessResult, RepoBindingResult } from "../core/types.js";
import { detect_binding, get_skill_path } from "../detect.js";
import { check_freshness } from "../domain/freshness.js";
import { detect_repo_binding } from "../domain/repo-binding.js";

// ── Types ────────────────────────────────────────────────────

interface IndexedConfig extends FeatureConfig {
	collection_key: string;
	skill_path: string;
}

interface RuntimeState {
	last_binding?: RepoBindingResult;
	last_freshness?: FreshnessResult;
}

// ── Footer ───────────────────────────────────────────────────

const QMD_STATUS_KEY = "qmd";

export function footer_text(binding?: RepoBindingResult, freshness?: FreshnessResult): string | undefined {
	if (!binding || binding.status !== "indexed") return undefined;

	if (!freshness || freshness.status === "fresh") return "qmd: indexed ✓";
	if (freshness.status === "stale") return `qmd: indexed · ${freshness.changed_count} stale`;
	return "qmd: indexed · freshness unknown";
}

function apply_footer(ctx: ExtensionContext, state: RuntimeState): void {
	ctx.ui.setStatus(QMD_STATUS_KEY, footer_text(state.last_binding, state.last_freshness));
}

// ── Runtime refresh ──────────────────────────────────────────

export async function refresh_state(ctx: ExtensionContext, state: RuntimeState): Promise<void> {
	const binding = await detect_repo_binding(ctx.cwd);
	state.last_binding = binding;

	if (binding.status !== "indexed") {
		state.last_freshness = undefined;
		apply_footer(ctx, state);
		return;
	}

	state.last_freshness = binding.marker
		? await check_freshness(binding.marker)
		: { status: "unknown", reason: "No local marker found." };
	apply_footer(ctx, state);
}

// ── Prompt hint ──────────────────────────────────────────────

export function build_prompt_hint(collection_key: string, skill_path: string): string {
	return [
		`This repository is indexed by QMD (collection: \`${collection_key}\`).`,
		"",
		"**Use QMD before rg/grep when:**",
		"- Starting unfamiliar work — search before reading random files",
		"- Checking for prior decisions — find out *why* something was designed a certain way",
		"- Looking for patterns — discover how other parts of the codebase handle similar problems",
		"- Finding related specs/plans — locate relevant docs you don't know exist",
		"- Searching for concepts — when you know *what* you need but not *where* it lives or what it's called",
		"",
		"**Use rg/grep instead** when you know the exact string, variable name, or file path.",
		"",
		"Quick reference:",
		"```bash",
		"# Semantic search (best quality — expansion + BM25 + vector + reranking)",
		`qmd query -c ${collection_key} "your question here"`,
		"",
		"# Keyword search (fast, no LLM, good for known terms)",
		`qmd search "exact keywords" -c ${collection_key}`,
		"",
		"# Get a specific document",
		`qmd get "path/to/file.md"`,
		"```",
		`Refer to \`${skill_path}\` for advanced usage (structured queries, intent, output formats).`,
	].join("\n");
}

// ── Feature registration ─────────────────────────────────────

export function register_indexed_feature(pi: ExtensionAPI): void {
	const state: RuntimeState = {};

	register_conditional_feature<IndexedConfig>(pi, {
		init: async (ctx) => {
			const binding = await detect_binding(ctx.cwd);

			if (binding.status !== "indexed") {
				return { enabled: false, collection_key: "", skill_path: "" };
			}

			return {
				enabled: true,
				collection_key: binding.collection_key,
				skill_path: get_skill_path(),
			};
		},

		get_skills: (config) => [config.skill_path],

		get_instructions: (config) => build_prompt_hint(config.collection_key, config.skill_path),

		activate: (ctx, config) => {
			state.last_binding = {
				status: "indexed",
				repo_root: ctx.cwd,
				collection_key: config.collection_key,
				marker: null,
				source: "store",
			};
			apply_footer(ctx, state);

			// Refresh freshness in the background after activation
			refresh_state(ctx, state);

			// Register runtime refresh on session tree/compact events
			for (const event_name of ["session_tree", "session_compact"] as const) {
				pi.on(event_name, async (_event, ctx) => {
					await refresh_state(ctx, state);
				});
			}
		},
	});
}
