import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	base_path,
	rendered_dir,
	type TemplateVariables,
	template_variables_schema,
	type WorkspaceConfig,
} from "./constants";

const SKILLS = ["linear"];

function parse_skill(template_path: string, vars: TemplateVariables): string {
	let content = readFileSync(template_path, "utf8");

	for (const [key, value] of Object.entries(vars)) {
		content = content.replaceAll(`{{${key}}}`, value);
	}

	return content;
}

export function generate_skills(vars: TemplateVariables): string[] {
	return SKILLS.map((name) => {
		const out = path.join(rendered_dir, name);

		mkdirSync(out, { recursive: true });

		const template_path = path.resolve(base_path, "skills", name, "SKILL.md");
		const parsed_skill = parse_skill(template_path, vars);

		writeFileSync(path.join(out, "SKILL.md"), parsed_skill);
		return out;
	});
}

export const build_template_vars = (config: WorkspaceConfig) =>
	template_variables_schema.parse({
		team: config.linear.team,
		team_lower: config.linear.team.toLowerCase(),
	});
