import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

type ValidationError = {
	file_path: string;
	message: string;
	hint: string;
};

const SKILL_REQUIRED_FIELDS = ["name", "description"] as const;
type SkillRequiredField = (typeof SKILL_REQUIRED_FIELDS)[number];

const SKILL_REQUIRED_SUPPORT_FILES: Record<string, string[]> = {
	plan: ["PLAN.md"],
};

const REQUIRED_SURFACES = [
	"README.md",
	"AGENTS.md",
	"CONTEXT.md",
	"docs/README.md",
	"docs/ARCHITECTURE.md",
	"docs/DESIGN-PRINCIPLES.md",
	"docs/coding-conventions.md",
	"docs/TESTING.md",
	"docs/specs/README.md",
	"docs/exec-plans/README.md",
	"docs/references/README.md",
] as const;

const FORBIDDEN_SURFACES = [
	"docs/QUALITY.md",
	"docs/CONTRIBUTING-DOCS.md",
	"docs/exec-plans/completed",
	"docs/exec-plans/tech-debt-tracker.md",
	"docs/reports",
	"docs/references/conditional-feature-registration.md",
	"scripts/audit-docs.ts",
] as const;

const ALLOWED_SHARED_REFERENCE_FILES = new Set(["README.md", "pi-api-reference.md"]);
const MIN_EXTENSION_README_WORDS = 80;
const MIN_EXTENSION_README_HEADINGS = 3;
const SKIP_PLAN_FILES = new Set(["README.md", "TEMPLATE.md"]);

const trimmed_string_schema = z.string().transform((value) => value.trim());
const non_empty_scalar_schema = trimmed_string_schema.refine(
	(value) => value.length > 0 && value !== "[]" && value !== "{}" && value !== "|" && value !== ">",
);
const non_empty_string_list_schema = z
	.array(trimmed_string_schema)
	.transform((values) => values.filter((value) => value.length > 0))
	.refine((values) => values.length > 0);
const required_frontmatter_value_schema = z.union([non_empty_scalar_schema, non_empty_string_list_schema]);
const frontmatter_fields_schema = z.record(z.string(), z.unknown());
const skill_frontmatter_schema = z
	.object({
		name: z.string().trim().min(1),
		description: z.string().trim().min(1),
	})
	.passthrough();

const SKILL_FIELD_HINTS: Record<SkillRequiredField, string> = {
	name: "Add 'name' to the SKILL.md frontmatter. Pi needs this to register and match the skill to user requests.",
	description:
		"Add 'description' to the SKILL.md frontmatter. Pi needs this to register and match the skill to user requests.",
};

async function main() {
	const repo_root = process.cwd();
	const errors: ValidationError[] = [];

	await validate_required_surfaces(repo_root, errors);
	await validate_forbidden_surfaces(repo_root, errors);
	await validate_package_scripts(repo_root, errors);
	await validate_shared_references(repo_root, errors);
	await validate_exec_plan_status(repo_root, errors);
	await validate_exec_plan_index(repo_root, errors);
	await validate_skill_frontmatter(repo_root, errors);
	await validate_extension_readmes(repo_root, errors);

	if (errors.length === 0) {
		console.log("✅ Documentation validation passed.");
		return;
	}

	console.error(`❌ Documentation validation failed with ${errors.length} issue(s):`);
	for (const error of errors) {
		console.error(`- ${error.file_path}: ${error.message}`);
		console.error(`  hint: ${error.hint}`);
	}

	process.exitCode = 1;
}

async function validate_required_surfaces(repo_root: string, errors: ValidationError[]) {
	for (const relative_path of REQUIRED_SURFACES) {
		const file_path = path.join(repo_root, relative_path);
		try {
			const info = await stat(file_path);
			if (!info.isFile()) {
				throw new Error("not a file");
			}
		} catch {
			push_error(
				repo_root,
				errors,
				file_path,
				`missing required documentation surface: ${relative_path}`,
				`Create '${relative_path}'. The documentation model depends on this entry surface or category guide existing in every clone of the repo.`,
			);
		}
	}
}

async function validate_forbidden_surfaces(repo_root: string, errors: ValidationError[]) {
	for (const relative_path of FORBIDDEN_SURFACES) {
		const target_path = path.join(repo_root, relative_path);
		try {
			await stat(target_path);
			push_error(
				repo_root,
				errors,
				target_path,
				`forbidden documentation surface still exists: ${relative_path}`,
				`Remove '${relative_path}'. Active docs should describe only the current operating model; inactive history belongs in '.graveyard/' when it still needs to be kept.`,
			);
		} catch {
			// Surface already absent.
		}
	}
}

async function validate_package_scripts(repo_root: string, errors: ValidationError[]) {
	const package_json_path = path.join(repo_root, "package.json");
	let content: string;
	try {
		content = await readFile(package_json_path, "utf8");
	} catch {
		return;
	}

	let json: unknown;
	try {
		json = JSON.parse(content);
	} catch {
		return;
	}

	const parsed = z
		.object({
			scripts: z.record(z.string(), z.string()).optional(),
		})
		.safeParse(json);
	if (!parsed.success) {
		return;
	}

	if (parsed.data.scripts?.audit) {
		push_error(
			repo_root,
			errors,
			package_json_path,
			"forbidden npm script still exists: audit",
			"Remove the 'audit' script. Structural documentation checks belong in 'check:docs'.",
		);
	}
}

async function validate_shared_references(repo_root: string, errors: ValidationError[]) {
	const references_dir = path.join(repo_root, "docs", "references");
	const entries = await readdir(references_dir, { withFileTypes: true }).catch(() => null);
	if (entries === null) {
		return;
	}

	for (const entry of entries) {
		if (!entry.isFile()) {
			push_error(
				repo_root,
				errors,
				path.join(references_dir, entry.name),
				"unexpected non-file entry in docs/references/",
				"Keep top-level docs/references/ limited to shared reference markdown files. Move owned references next to their owner.",
			);
			continue;
		}

		if (!ALLOWED_SHARED_REFERENCE_FILES.has(entry.name)) {
			push_error(
				repo_root,
				errors,
				path.join(references_dir, entry.name),
				`unexpected shared reference file: ${entry.name}`,
				`Only approved shared references may live in docs/references/. Move '${entry.name}' next to its owner or update the allowlist intentionally.`,
			);
		}
	}
}

async function validate_exec_plan_status(repo_root: string, errors: ValidationError[]) {
	const active_dir = path.join(repo_root, "docs", "exec-plans", "active");
	const plan_files = await list_plan_files(active_dir);

	for (const file_name of plan_files) {
		const file_path = path.join(active_dir, file_name);
		const content = await safe_read_file(file_path);
		if (content === null) {
			continue;
		}

		if (/^Status:\s*Completed?\s*$/imu.test(content)) {
			push_error(
				repo_root,
				errors,
				file_path,
				"completed exec plan still lives in active/",
				"Archive this file under '.graveyard/docs/exec-plans/' once the work is finished and the status is marked complete.",
			);
		}
	}
}

async function validate_exec_plan_index(repo_root: string, errors: ValidationError[]) {
	const index_path = path.join(repo_root, "docs", "exec-plans", "README.md");
	const index_content = await safe_read_file(index_path);
	if (index_content === null) {
		return;
	}

	const wikilink_pattern = /\[\[docs\/exec-plans\/active\/([^\]]+)\]\]/gu;
	const referenced_paths = new Set<string>();

	for (const match of index_content.matchAll(wikilink_pattern)) {
		const slug = match[1];
		const file_name = slug.endsWith(".md") ? slug : `${slug}.md`;
		referenced_paths.add(`active/${file_name}`);
	}

	for (const ref_path of referenced_paths) {
		const full_path = path.join(repo_root, "docs", "exec-plans", ref_path);
		const content = await safe_read_file(full_path);
		if (content === null) {
			push_error(
				repo_root,
				errors,
				index_path,
				`phantom exec-plan index entry: ${ref_path}`,
				"Remove or update the stale reference in docs/exec-plans/README.md.",
			);
		}
	}

	const active_dir = path.join(repo_root, "docs", "exec-plans", "active");
	const active_files = await list_plan_files(active_dir);

	for (const file_name of active_files) {
		const ref_key = `active/${file_name}`;
		if (!referenced_paths.has(ref_key)) {
			push_error(
				repo_root,
				errors,
				path.join(active_dir, file_name),
				"active exec plan missing from docs/exec-plans/README.md",
				"Add this file to the active plans section so the category guide stays restartable.",
			);
		}
	}
}

async function validate_skill_frontmatter(repo_root: string, errors: ValidationError[]) {
	const skills_dir = path.join(repo_root, "skills");
	let skill_dirs: string[] = [];
	try {
		skill_dirs = await collect_skill_dirs(skills_dir);
	} catch {
		return;
	}

	for (const skill_dir of skill_dirs) {
		const expected_name = path.basename(skill_dir);
		const file_path = path.join(skill_dir, "SKILL.md");

		let file_content: string;
		try {
			file_content = await readFile(file_path, "utf8");
		} catch {
			push_error(
				repo_root,
				errors,
				file_path,
				"missing SKILL.md",
				"Every skill directory needs a SKILL.md with frontmatter (name, description). Pi uses this to register the skill and show it in available_skills. See any existing skill for the format.",
			);
			continue;
		}

		const frontmatter = extract_frontmatter(file_content);
		if (!frontmatter) {
			push_error(
				repo_root,
				errors,
				file_path,
				"missing frontmatter block",
				"Skills require YAML frontmatter between --- markers for Pi to register them. At minimum: name and description fields.",
			);
			continue;
		}

		const fields = parse_frontmatter_fields(frontmatter);
		if (!fields) {
			push_error(
				repo_root,
				errors,
				file_path,
				"invalid frontmatter YAML",
				"Fix YAML syntax in SKILL.md frontmatter. Keep a valid YAML block with at least 'name' and 'description'.",
			);
			continue;
		}

		const skill_result = skill_frontmatter_schema.safeParse(fields);
		if (!skill_result.success) {
			push_skill_frontmatter_errors(repo_root, errors, file_path, fields, skill_result.error);
		}

		const normalized_name = parse_required_scalar(skill_result.success ? skill_result.data.name : fields.name)
			?.replace(/^"|"$/gu, "")
			.replace(/^'|'$/gu, "");
		if (normalized_name && normalized_name !== expected_name) {
			push_error(
				repo_root,
				errors,
				file_path,
				`frontmatter name '${normalized_name}' does not match directory name '${expected_name}'`,
				`The SKILL.md 'name' field must match the directory name '${expected_name}'. Pi uses the directory name for routing; a mismatch causes silent registration failures.`,
			);
		}

		const required_support_files = SKILL_REQUIRED_SUPPORT_FILES[expected_name] ?? [];
		for (const support_filename of required_support_files) {
			const support_file_path = path.join(skill_dir, support_filename);
			try {
				await readFile(support_file_path, "utf8");
			} catch {
				push_error(
					repo_root,
					errors,
					support_file_path,
					`missing required support file for skill '${expected_name}': ${support_filename}`,
					`This skill depends on '${support_filename}' for portable, self-contained guidance. Add the file next to ${path.relative(repo_root, file_path)} so the skill works consistently across repositories.`,
				);
			}
		}
	}
}

async function validate_extension_readmes(repo_root: string, errors: ValidationError[]) {
	const extensions_dir = path.join(repo_root, "extensions");
	const entries = await readdir(extensions_dir, { withFileTypes: true }).catch(() => null);
	if (entries === null) {
		return;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const readme_path = path.join(extensions_dir, entry.name, "README.md");
		let file_content: string;
		try {
			file_content = await readFile(readme_path, "utf8");
		} catch {
			push_error(
				repo_root,
				errors,
				readme_path,
				"missing extension README.md",
				"Every extension must have a README.md — agents and humans use it for orientation before reading source. Document: what it does, how it's triggered, any setup/requirements. See extensions/todos/README.md as a reference.",
			);
			continue;
		}

		const content_without_code = file_content.replace(/```[\s\S]*?```/gu, " ").replace(/`[^`]*`/gu, " ");
		const words = content_without_code.split(/\s+/u).filter(Boolean);
		const headings = file_content.match(/^#{1,6}\s+/gmu) ?? [];

		if (words.length < MIN_EXTENSION_README_WORDS) {
			push_error(
				repo_root,
				errors,
				readme_path,
				`README is too short (${words.length} words; minimum ${MIN_EXTENSION_README_WORDS})`,
				"Extension READMEs need enough detail for an agent to understand behavior without reading source. Add sections for behavior, usage, and requirements. See extensions/todos/README.md as a reference.",
			);
		}

		if (headings.length < MIN_EXTENSION_README_HEADINGS) {
			push_error(
				repo_root,
				errors,
				readme_path,
				`README has insufficient structure (${headings.length} headings; minimum ${MIN_EXTENSION_README_HEADINGS})`,
				"Use markdown headings to make the README scannable (for example ## Behavior, ## Usage, ## Requirements). Flat prose is harder for agents to navigate.",
			);
		}
	}
}

async function collect_skill_dirs(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const has_skill_file = entries.some((entry) => entry.isFile() && entry.name === "SKILL.md");
	if (has_skill_file) {
		return [dir];
	}

	const results: string[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		if (entry.name === "node_modules" || entry.name.startsWith(".")) {
			continue;
		}

		const nested = await collect_skill_dirs(path.join(dir, entry.name));
		results.push(...nested);
	}

	return results;
}

async function list_plan_files(dir_path: string): Promise<string[]> {
	try {
		const entries = await readdir(dir_path, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !SKIP_PLAN_FILES.has(entry.name))
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

async function safe_read_file(file_path: string): Promise<string | null> {
	try {
		return await readFile(file_path, "utf8");
	} catch {
		return null;
	}
}

function extract_frontmatter(file_content: string): string | null {
	const match = file_content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
	if (!match) {
		return null;
	}
	return match[1];
}

function parse_frontmatter_fields(frontmatter: string): Record<string, unknown> | null {
	try {
		const parsed = YAML.parse(frontmatter, { schema: "failsafe" });
		const result = frontmatter_fields_schema.safeParse(parsed);
		if (!result.success) {
			return null;
		}
		return result.data;
	} catch {
		return null;
	}
}

function is_skill_required_field(field_name: string): field_name is SkillRequiredField {
	return SKILL_REQUIRED_FIELDS.includes(field_name as SkillRequiredField);
}

function has_required_frontmatter_value(value: unknown): boolean {
	return required_frontmatter_value_schema.safeParse(value).success;
}

function push_skill_frontmatter_errors(
	repo_root: string,
	errors: ValidationError[],
	file_path: string,
	fields: Record<string, unknown>,
	error: z.ZodError,
) {
	const handled_fields = new Set<SkillRequiredField>();

	for (const issue of error.issues) {
		const field_name = typeof issue.path[0] === "string" ? issue.path[0] : undefined;
		if (!field_name || !is_skill_required_field(field_name)) {
			continue;
		}
		if (handled_fields.has(field_name)) {
			continue;
		}
		handled_fields.add(field_name);

		if (!has_required_frontmatter_value(fields[field_name])) {
			push_error(
				repo_root,
				errors,
				file_path,
				`missing required frontmatter field: ${field_name}`,
				SKILL_FIELD_HINTS[field_name],
			);
			continue;
		}

		push_error(repo_root, errors, file_path, `invalid ${field_name} field`, SKILL_FIELD_HINTS[field_name]);
	}

	if (handled_fields.size === 0) {
		push_error(
			repo_root,
			errors,
			file_path,
			"invalid skill frontmatter",
			"Ensure SKILL.md frontmatter is valid YAML with non-empty 'name' and 'description' fields.",
		);
	}
}

function parse_required_scalar(value: unknown): string | undefined {
	const result = non_empty_scalar_schema.safeParse(value);
	if (!result.success) {
		return undefined;
	}
	return result.data;
}

function push_error(repo_root: string, errors: ValidationError[], file_path: string, message: string, hint: string) {
	errors.push({
		file_path: path.relative(repo_root, file_path),
		message,
		hint,
	});
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`❌ Documentation validation crashed: ${message}`);
	process.exitCode = 1;
});
