import { readFileSync } from "node:fs";
import path from "node:path";
import { base_path, type WorkspaceConfig, workspace_config_schema } from "./constants";

export function load_workspace_config(): WorkspaceConfig | null {
	try {
		const file = readFileSync(path.resolve(base_path, "config.json"), "utf8");
		const config = workspace_config_schema.parse(JSON.parse(file));
		const work_root = config.work_root.replace(/^~/, process.env.HOME ?? "");

		return {
			...config,
			work_root: path.resolve(work_root),
		};
	} catch {
		return null;
	}
}
