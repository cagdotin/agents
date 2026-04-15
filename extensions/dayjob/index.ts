import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { z } from "zod";
import { type FeatureConfig, register_conditional_feature } from "../../lib/extension-runtime/conditional-feature.js";

const base_path = path.dirname(new URL(import.meta.url).pathname);

const workspace_config_schema = z.object({
	work_root: z.string().regex(/^~\//, "work_root must start with ~/"),
});

type WorkspaceConfig = z.infer<typeof workspace_config_schema>;

function load_config(): WorkspaceConfig | undefined {
	try {
		const file = readFileSync(path.resolve(base_path, "config.json"), "utf8");
		const config = workspace_config_schema.parse(JSON.parse(file));
		return {
			work_root: path.resolve(config.work_root.replace(/^~/, process.env.HOME ?? "")),
		};
	} catch {
		return undefined;
	}
}

const get_skill_path = (skill_name: string) => path.resolve(base_path, "skills", skill_name);

interface Config extends FeatureConfig {
	cwd: string;
}

function detect_work_context(cwd: string, config?: WorkspaceConfig): Config {
	if (!config) return { enabled: false, cwd };

	const resolved = path.resolve(cwd);

	return {
		enabled: resolved === config.work_root || resolved.startsWith(`${config.work_root}/`),
		cwd: resolved,
	};
}

export default function dayjob(pi: ExtensionAPI) {
	const config = load_config();

	register_conditional_feature<Config>(pi, {
		init: (ctx) => detect_work_context(ctx.cwd, config),
		get_skills: (_config) => [get_skill_path("linear")],
		activate: (ctx, _config) => {
			ctx.ui.setStatus("dayjob", "dayjob");
		},
	});
}
