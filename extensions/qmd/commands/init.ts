import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { InvalidInitProposalError } from "../core/errors.js";
import { QmdInitParams, qmd_init_params_schema } from "../core/types.js";
import { detect_binding } from "../detect.js";
import {
	build_draft_proposal,
	build_init_prompt,
	execute_init,
	normalize_init_proposal,
	scan_repo,
} from "../domain/onboarding.js";
import { resolve_repo_root } from "../domain/repo-binding.js";

// ── Tool lifecycle ───────────────────────────────────────────

const TOOL_NAME = "qmd_init";

function activate_tool(pi: ExtensionAPI): void {
	const tools = new Set(pi.getActiveTools());
	tools.add(TOOL_NAME);
	pi.setActiveTools([...tools]);
}

function deactivate_tool(pi: ExtensionAPI): void {
	const tools = new Set(pi.getActiveTools());
	tools.delete(TOOL_NAME);
	pi.setActiveTools([...tools]);
}

// ── Command + tool registration ──────────────────────────────

export function register_init_command(pi: ExtensionAPI): void {
	let workflow_prompt: string | undefined;

	// Tool — registered always, deactivated by default
	pi.registerTool({
		name: TOOL_NAME,
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

				workflow_prompt = undefined;

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
				deactivate_tool(pi);
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

	// Inject workflow prompt when active
	pi.on("before_agent_start", async (event) => {
		if (!workflow_prompt) return undefined;
		return {
			systemPrompt: `${event.systemPrompt}\n\n# QMD Init Workflow\n\n${workflow_prompt}`,
		};
	});

	// Deactivate tool on session events when no workflow is active
	for (const event_name of ["session_start", "session_tree", "session_compact"] as const) {
		pi.on(event_name, async () => {
			if (!workflow_prompt) deactivate_tool(pi);
		});
	}

	// Command
	pi.registerCommand("qmd", {
		description: "QMD onboarding — initialize the index for this repository",
		async handler(args, ctx) {
			const sub = (args ?? "").trim();
			if (sub && sub !== "init") {
				notify(ctx, "Usage: /qmd init");
				return;
			}

			const binding = await detect_binding(ctx.cwd);

			if (binding.status === "indexed") {
				notify(ctx, "This repo is already indexed by QMD.");
				return;
			}

			if (binding.status === "unavailable") {
				notify(ctx, `QMD unavailable: ${binding.reason}`, "warning");
				return;
			}

			const repo_root = await resolve_repo_root(ctx.cwd);
			const repo_scan = await scan_repo(repo_root);
			const draft = build_draft_proposal(repo_scan);

			workflow_prompt = build_init_prompt(repo_scan, draft);
			activate_tool(pi);

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

			notify(ctx, "Started /qmd init. Review the proposal in chat, then confirm before execution.");
		},
	});
}

function notify(ctx: ExtensionContext, message: string, level = "info"): void {
	if (ctx.hasUI) {
		ctx.ui.notify(message, level);
	} else {
		console.log(message);
	}
}
