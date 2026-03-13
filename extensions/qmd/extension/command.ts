import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { embed_pending, update_collection } from "../core/qmd-store.js";
import type { FreshnessResult, RepoBindingResult } from "../core/types.js";
import { check_freshness, get_repo_head_commit } from "../domain/freshness.js";
import { build_draft_proposal, build_init_prompt, scan_repo } from "../domain/onboarding.js";
import {
	collection_key_from_repo_root,
	detect_repo_binding,
	read_repo_marker,
	resolve_repo_root,
	write_repo_marker,
} from "../domain/repo-binding.js";
import { type QmdExtensionState, refresh_runtime_state } from "./runtime.js";
import { activate_qmd_init_tool } from "./tool.js";

function output_message(
	ctx: { hasUI: boolean; ui: { notify: (message: string, level: string) => void } },
	message: string,
	level = "info",
) {
	if (ctx.hasUI) {
		ctx.ui.notify(message, level);
		return;
	}
	console.log(message);
}

function render_freshness(freshness: FreshnessResult | undefined): string {
	if (!freshness) {
		return "freshness: unknown";
	}
	if (freshness.status === "fresh") {
		return "freshness: fresh";
	}
	if (freshness.status === "stale") {
		return `freshness: stale (${freshness.changed_count} markdown file(s))`;
	}
	return `freshness: unknown (${freshness.reason})`;
}

function render_status(binding: RepoBindingResult, freshness?: FreshnessResult): string {
	if (binding.status === "unavailable") {
		return `QMD unavailable\n${binding.reason}`;
	}

	if (binding.status === "not_indexed") {
		const lines = [`QMD status: not indexed`, `repo_root: ${binding.repo_root}`];
		if (binding.repair_warning) {
			lines.push(`note: ${binding.repair_warning}`);
		}
		lines.push(`suggested collection key: ${collection_key_from_repo_root(binding.repo_root)}`);
		lines.push("Next step: run /qmd init");
		return lines.join("\n");
	}

	const lines = [
		"QMD status: indexed",
		`repo_root: ${binding.repo_root}`,
		`collection_key: ${binding.collection_key}`,
		`binding_source: ${binding.source}`,
		render_freshness(freshness),
	];

	if (binding.repair_warning) {
		lines.push(`note: ${binding.repair_warning}`);
	}

	return lines.join("\n");
}

export function register_qmd_command(pi: ExtensionAPI, state: QmdExtensionState): void {
	pi.registerCommand("qmd", {
		description: "Manage QMD repo onboarding, status, and scoped updates",
		handler: async (args, ctx) => {
			const sub_command = (args ?? "").trim() || "status";

			if (sub_command === "status") {
				const binding = await detect_repo_binding(ctx.cwd);
				const freshness =
					binding.status === "indexed" && binding.marker ? await check_freshness(binding.marker) : undefined;
				state.last_binding = binding;
				state.last_freshness = freshness;
				await refresh_runtime_state(ctx, state);
				output_message(ctx, render_status(binding, freshness), "info");
				return;
			}

			if (sub_command === "update") {
				const binding = await detect_repo_binding(ctx.cwd);
				if (binding.status !== "indexed") {
					output_message(ctx, render_status(binding), binding.status === "unavailable" ? "warning" : "info");
					return;
				}

				output_message(ctx, `Updating QMD collection ${binding.collection_key}...`, "info");
				const update_result = await update_collection(binding.collection_key);
				const embed_result = update_result.needsEmbedding > 0 ? await embed_pending() : null;
				const now = new Date().toISOString();
				const existing_marker = await read_repo_marker(binding.repo_root).catch(() => null);
				await write_repo_marker(binding.repo_root, {
					schema_version: 1,
					repo_root: binding.repo_root,
					collection_key: binding.collection_key,
					last_indexed_at: now,
					last_indexed_commit: (await get_repo_head_commit(binding.repo_root)) ?? "",
					created_at: existing_marker?.created_at ?? now,
				});

				await refresh_runtime_state(ctx, state);
				const lines = [
					`QMD update complete for ${binding.collection_key}.`,
					`indexed: ${update_result.indexed}, updated: ${update_result.updated}, unchanged: ${update_result.unchanged}, removed: ${update_result.removed}`,
				];
				if (embed_result) {
					lines.push(`embeddings: embedded ${embed_result.embedded}, skipped ${embed_result.skipped}`);
				}
				if (binding.repair_warning) {
					lines.push(`note: ${binding.repair_warning}`);
				}
				output_message(ctx, lines.join("\n"), "info");
				return;
			}

			if (sub_command === "init") {
				const binding = await detect_repo_binding(ctx.cwd);
				if (binding.status === "indexed") {
					const freshness = binding.marker ? await check_freshness(binding.marker) : undefined;
					output_message(ctx, `${render_status(binding, freshness)}\n\nThis repo already has a QMD binding.`, "info");
					return;
				}
				if (binding.status === "unavailable") {
					output_message(ctx, render_status(binding), "warning");
					return;
				}

				const repo_root = await resolve_repo_root(ctx.cwd);
				const scan = await scan_repo(repo_root);
				const draft = build_draft_proposal(scan);
				state.init_workflow = {
					repo_root,
					prompt: build_init_prompt(scan, draft),
				};
				activate_qmd_init_tool(pi);

				const kickoff = [
					"Help me review a QMD onboarding proposal for this repository.",
					"Present the proposed collection setup and path contexts clearly.",
					"Ask for explicit confirmation before calling qmd_init.",
				].join(" ");

				if (ctx.isIdle()) {
					pi.sendUserMessage(kickoff);
				} else {
					pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
				}

				output_message(
					ctx,
					"Started /qmd init. Review the proposal in chat, then explicitly confirm before execution.",
					"info",
				);
				return;
			}

			output_message(ctx, "Usage: /qmd [status | update | init]", "info");
		},
	});
}
