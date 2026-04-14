import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { InvalidInitProposalError } from "../core/errors.js";
import { QmdInitParams, qmd_init_params_schema } from "../core/types.js";
import { execute_init, normalize_init_proposal } from "../domain/onboarding.js";
import { resolve_repo_root } from "../domain/repo-binding.js";
import { type QmdExtensionState, refresh_runtime_state } from "./runtime.js";

export const QMD_INIT_TOOL_NAME = "qmd_init";

export function activate_qmd_init_tool(pi: ExtensionAPI) {
	const active_tools = new Set(pi.getActiveTools());
	active_tools.add(QMD_INIT_TOOL_NAME);
	pi.setActiveTools([...active_tools]);
}

export function deactivate_qmd_init_tool(pi: ExtensionAPI) {
	const active_tools = new Set(pi.getActiveTools());
	active_tools.delete(QMD_INIT_TOOL_NAME);
	pi.setActiveTools([...active_tools]);
}

export function register_qmd_tool(pi: ExtensionAPI, state: QmdExtensionState): void {
	for (const event_name of ["session_start", "session_tree", "session_compact"] as const) {
		pi.on(event_name, async () => {
			if (!state.init_workflow) {
				deactivate_qmd_init_tool(pi);
			}
		});
	}

	pi.registerTool({
		name: QMD_INIT_TOOL_NAME,
		label: "QMD Init",
		description: "Execute a confirmed QMD onboarding proposal for the current repository.",
		promptSnippet: "Execute a confirmed QMD onboarding proposal after the user explicitly approves it.",
		promptGuidelines: [
			"Use qmd_init only during the /qmd init workflow.",
			"Do not call qmd_init until the user has explicitly confirmed the proposal.",
		],
		parameters: QmdInitParams,
		async execute(_tool_call_id, params, _signal, on_update, ctx) {
			try {
				if (!state.init_workflow) {
					throw new InvalidInitProposalError("qmd_init is only available during an active /qmd init workflow.");
				}

				const parsed = qmd_init_params_schema.safeParse(params);
				if (!parsed.success) {
					throw new InvalidInitProposalError(
						parsed.error.issues.map((issue) => issue.message).join("; "),
						parsed.error,
					);
				}

				const expected_root = await resolve_repo_root(ctx.cwd);
				const proposal = await normalize_init_proposal(parsed.data, expected_root);
				const result = await execute_init(proposal, (message) => {
					on_update?.({ content: [{ type: "text", text: message }] });
				});

				state.init_workflow = undefined;
				await refresh_runtime_state(ctx, state);

				const lines = [
					`QMD init complete for ${result.repo_root}.`,
					`Collection: ${result.collection_key}`,
					`Indexed: ${result.update_result.indexed}, updated: ${result.update_result.updated}, unchanged: ${result.update_result.unchanged}, removed: ${result.update_result.removed}`,
				];
				if (result.embed_result) {
					lines.push(`Embeddings: embedded ${result.embed_result.embedded}, skipped ${result.embed_result.skipped}.`);
				}

				return {
					content: [{ type: "text", text: lines.join("\n") }],
					details: result,
				};
			} finally {
				deactivate_qmd_init_tool(pi);
			}
		},
		renderCall(_args, theme: Theme) {
			return new Text(theme.fg("toolTitle", theme.bold("qmd_init")), 0, 0);
		},
		renderResult(result, { isPartial }, theme: Theme) {
			if (isPartial) {
				const text = result.content?.[0];
				return new Text(theme.fg("warning", text?.type === "text" ? text.text : "Working..."), 0, 0);
			}
			const text = result.content?.[0];
			return new Text(text?.type === "text" ? text.text : "", 0, 0);
		},
	});
}
