import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";
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

interface QmdFeatureState {
	binding: RepoBindingResult;
	skill_path: string;
}

function get_skill_path(): string {
	return path.resolve(path.dirname(new URL(import.meta.url).pathname), "skills", "qmd", "SKILL.md");
}

export default function qmd_extension(pi: ExtensionAPI) {
	const state: QmdExtensionState = {};

	register_conditional_feature<QmdFeatureState>(pi, {
		feature_name: "qmd",
		detect: async ({ cwd }) => ({
			binding: await detect_repo_binding(cwd),
			skill_path: get_skill_path(),
		}),
		should_activate: (feature_state) => feature_state.binding.status !== "unavailable",
		should_include_skills: (feature_state) => feature_state.binding.status === "indexed",
		activate: async ({ ctx }) => {
			register_runtime(pi, state);
			register_qmd_tool(pi, state);
			register_qmd_command(pi, state);
			await bootstrap_runtime_state(ctx, state);
		},
		skill_paths: (feature_state) => [feature_state.skill_path],
		system_prompt_hint: (feature_state) =>
			feature_state.binding.status === "indexed"
				? build_qmd_prompt_hint(feature_state.binding.collection_key, feature_state.skill_path)
				: undefined,
	});
}
