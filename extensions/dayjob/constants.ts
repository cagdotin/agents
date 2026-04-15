import path from "node:path";
import { z } from "zod";

export const base_path = path.dirname(new URL(import.meta.url).pathname);
export const rendered_dir = path.resolve(base_path, "out", "skills");

const linear_config_schema = z.object({
	team: z.string().min(1),
});

export const workspace_config_schema = z.object({
	work_root: z.string().regex(/^~\//, "work_root must start with ~/"),
	linear: linear_config_schema,
});

export const template_variables_schema = z.object({
	team: z.string().min(1),
	team_lower: z.string().min(1),
});

export type WorkspaceConfig = z.infer<typeof workspace_config_schema>;
export type TemplateVariables = z.infer<typeof template_variables_schema>;
