import path from "node:path";
import type { BeforeAgentStartEvent, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RepoBindingResult } from "./core/types.js";
import { detect_repo_binding } from "./domain/repo-binding.js";
import { register_qmd_command } from "./extension/command.js";
import {
	bootstrap_runtime_state,
	build_qmd_prompt_hint,
	type QmdExtensionState,
	register_runtime,
} from "./extension/runtime.js";
import { register_qmd_tool } from "./extension/tool.js";

interface QmdDetectionResult {
	binding?: RepoBindingResult;
	active: boolean;
	detected: boolean;
	cwd: string;
	reason: "startup" | "reload";
}

function get_skill_path(): string {
	return path.resolve(path.dirname(new URL(import.meta.url).pathname), "skills", "qmd", "SKILL.md");
}

export default function qmd_extension(pi: ExtensionAPI) {
	const state: QmdExtensionState = {};
	const skill_path = get_skill_path();
	let last_detection: QmdDetectionResult | undefined;
	let activated = false;

	async function evaluate(cwd: string, reason: "startup" | "reload"): Promise<QmdDetectionResult> {
		if (last_detection && last_detection.cwd === cwd && last_detection.reason === reason) {
			return last_detection;
		}

		try {
			const binding = await detect_repo_binding(cwd);
			last_detection = {
				binding,
				active: binding.status !== "unavailable",
				detected: true,
				cwd,
				reason,
			};
			return last_detection;
		} catch {
			last_detection = {
				binding: undefined,
				active: false,
				detected: false,
				cwd,
				reason,
			};
			return last_detection;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		const detection = await evaluate(ctx.cwd, "startup");
		if (!detection.active || activated) {
			return;
		}

		activated = true;
		register_runtime(pi, state);
		register_qmd_tool(pi, state);
		register_qmd_command(pi, state);
		await bootstrap_runtime_state(ctx, state);
	});

	pi.on("resources_discover", async (event) => {
		const detection = await evaluate(event.cwd, event.reason);
		if (!detection.detected || detection.binding?.status !== "indexed") {
			return undefined;
		}

		return {
			skillPaths: [skill_path],
		};
	});

	pi.on("before_agent_start", (event: BeforeAgentStartEvent) => {
		if (!last_detection?.detected || !last_detection.active || last_detection.binding?.status !== "indexed") {
			return undefined;
		}

		return {
			systemPrompt: `${event.systemPrompt}\n\n${build_qmd_prompt_hint(last_detection.binding.collection_key, skill_path)}`,
		};
	});
}
