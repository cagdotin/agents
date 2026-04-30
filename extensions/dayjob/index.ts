import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type FeatureConfig, register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";
import { load_workspace_config } from "./config.js";
import type { WorkspaceConfig } from "./constants.js";
import { build_template_vars, generate_skills } from "./skills.js";

interface Config extends FeatureConfig {
	skills: string[];
}

function detect_work_context(cwd: string, config: WorkspaceConfig): Config {
	if (!config) return { enabled: false, skills: [] };

	const resolved = path.resolve(cwd);

	return {
		enabled: config.work_roots.some((root) => resolved === root || resolved.startsWith(`${root}/`)),
		skills: [],
	};
}

export default function dayjob(pi: ExtensionAPI) {
	const workspace_config = load_workspace_config();

	if (!workspace_config) return;

	register_conditional_feature<Config>(pi, {
		init: (ctx) => {
			const config = detect_work_context(ctx.cwd, workspace_config);

			if (config.enabled) {
				const template_vars = build_template_vars(workspace_config);
				config.skills = generate_skills(template_vars);
			}

			return config;
		},
		get_skills: (feature_config) => feature_config.skills,
		activate: (ctx, _feature_config) => {
			ctx.ui.setStatus("dayjob", "meister");
		},
	});
}
