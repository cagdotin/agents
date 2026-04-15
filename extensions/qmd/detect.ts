import path from "node:path";
import type { RepoBindingResult } from "./core/types.js";
import { detect_repo_binding } from "./domain/repo-binding.js";

const base_path = path.dirname(new URL(import.meta.url).pathname);

export function get_skill_path(): string {
	return path.resolve(base_path, "skills", "qmd", "SKILL.md");
}

export async function detect_binding(cwd: string): Promise<RepoBindingResult> {
	try {
		return await detect_repo_binding(cwd);
	} catch {
		return { status: "unavailable", repo_root: cwd, reason: "QMD detection failed." };
	}
}
