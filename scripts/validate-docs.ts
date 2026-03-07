import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

type ValidationError = {
	file_path: string;
	message: string;
	hint: string;
};

const RESOURCE_REQUIRED_FIELDS = [
	"title",
	"type",
	"source",
	"url",
	"author",
	"date_captured",
	"tags",
	"status",
	"description",
] as const;

type ResourceRequiredField = (typeof RESOURCE_REQUIRED_FIELDS)[number];

const SKILL_REQUIRED_FIELDS = ["name", "description"] as const;
type SkillRequiredField = (typeof SKILL_REQUIRED_FIELDS)[number];

const SKILL_REQUIRED_SUPPORT_FILES: Record<string, string[]> = {
	plan: ["PLAN.md"],
};

const MIN_EXTENSION_README_WORDS = 80;
const MIN_EXTENSION_README_HEADINGS = 3;

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

// Boundary contract for docs/resources/*.md frontmatter.
// We validate the full shape with Zod, then map issues to stable, agent-legible hints.
const resource_frontmatter_schema = z
	.object({
		title: z.string().trim().min(1),
		type: z.string().trim().min(1),
		source: z.string().trim().min(1),
		url: z
			.string()
			.trim()
			.url()
			.refine((value) => /^https?:\/\/\S+/u.test(value)),
		author: z.string().trim().min(1),
		date_captured: z
			.string()
			.trim()
			.regex(/^\d{4}-\d{2}-\d{2}$/u),
		tags: z.array(z.string().trim().min(1)).min(1),
		status: z.string().trim().min(1),
		description: z.string().trim().min(1),
	})
	.passthrough();

const RESOURCE_FIELD_HINTS: Record<ResourceRequiredField, string> = {
	title:
		"Add 'title' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
	type: "Add 'type' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
	source:
		"Add 'source' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
	url: "Set 'url' to a full http(s) URL so agents can trace back to the original source. Example: url: https://example.com/article",
	author:
		"Add 'author' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
	date_captured:
		"Use YYYY-MM-DD format for date_captured (e.g. 2026-03-06). This enables staleness checks and chronological sorting.",
	tags: "Set 'tags' to a non-empty YAML list so agents can classify and retrieve resources by topic.",
	status:
		"Add 'status' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
	description:
		"Add 'description' to the YAML frontmatter. This field is required for resource indexing and agent discoverability. See docs/resources/TEMPLATE.md for the full schema.",
};

// Boundary contract for skills/*/SKILL.md frontmatter.
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

	await validate_resource_frontmatter(repo_root, errors);
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

async function validate_resource_frontmatter(repo_root: string, errors: ValidationError[]) {
	const resources_dir = path.join(repo_root, "docs", "resources");
	const entries = await readdir(resources_dir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) {
			continue;
		}

		if (entry.name === "README.md" || entry.name === "TEMPLATE.md") {
			continue;
		}

		const file_path = path.join(resources_dir, entry.name);
		const file_content = await readFile(file_path, "utf8");
		const frontmatter = extract_frontmatter(file_content);
		if (!frontmatter) {
			push_error(
				repo_root,
				errors,
				file_path,
				"missing frontmatter block",
				"Resources require YAML frontmatter between --- markers so agents can discover and filter them. Copy the structure from docs/resources/TEMPLATE.md.",
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
				"Fix YAML syntax in the frontmatter block. Start from docs/resources/TEMPLATE.md and ensure indentation/list markers are valid YAML.",
			);
			continue;
		}

		const resource_result = resource_frontmatter_schema.safeParse(fields);
		if (!resource_result.success) {
			push_resource_frontmatter_errors(repo_root, errors, file_path, fields, resource_result.error);
		}
	}
}

async function validate_skill_frontmatter(repo_root: string, errors: ValidationError[]) {
	const skills_dir = path.join(repo_root, "skills");
	const entries = await readdir(skills_dir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const expected_name = entry.name;
		const file_path = path.join(skills_dir, expected_name, "SKILL.md");

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
			const support_file_path = path.join(skills_dir, expected_name, support_filename);
			try {
				await readFile(support_file_path, "utf8");
			} catch {
				push_error(
					repo_root,
					errors,
					support_file_path,
					`missing required support file for skill '${expected_name}': ${support_filename}`,
					`This skill depends on '${support_filename}' for portable, self-contained guidance. Add the file in skills/${expected_name}/ so the skill works consistently across repositories.`,
				);
			}
		}
	}
}

async function validate_extension_readmes(repo_root: string, errors: ValidationError[]) {
	const extensions_dir = path.join(repo_root, "extensions");
	const entries = await readdir(extensions_dir, { withFileTypes: true });

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
				"Use markdown headings to make the README scannable (e.g. ## Behavior, ## Usage, ## Requirements). Flat prose is harder for agents to navigate.",
			);
		}
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

function is_resource_required_field(field_name: string): field_name is ResourceRequiredField {
	return RESOURCE_REQUIRED_FIELDS.includes(field_name as ResourceRequiredField);
}

function is_skill_required_field(field_name: string): field_name is SkillRequiredField {
	return SKILL_REQUIRED_FIELDS.includes(field_name as SkillRequiredField);
}

function has_required_frontmatter_value(value: unknown): boolean {
	return required_frontmatter_value_schema.safeParse(value).success;
}

// Keep user-facing diagnostics stable even when schema internals change.
function push_resource_frontmatter_errors(
	repo_root: string,
	errors: ValidationError[],
	file_path: string,
	fields: Record<string, unknown>,
	error: z.ZodError,
) {
	const handled_fields = new Set<ResourceRequiredField>();

	for (const issue of error.issues) {
		const field_name = typeof issue.path[0] === "string" ? issue.path[0] : undefined;
		if (!field_name || !is_resource_required_field(field_name)) {
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
				RESOURCE_FIELD_HINTS[field_name],
			);
			continue;
		}

		if (field_name === "url") {
			push_error(repo_root, errors, file_path, "invalid url field", RESOURCE_FIELD_HINTS.url);
			continue;
		}

		if (field_name === "date_captured") {
			push_error(repo_root, errors, file_path, "invalid date_captured format", RESOURCE_FIELD_HINTS.date_captured);
			continue;
		}

		if (field_name === "tags") {
			push_error(repo_root, errors, file_path, "invalid tags field", RESOURCE_FIELD_HINTS.tags);
			continue;
		}

		push_error(repo_root, errors, file_path, `invalid ${field_name} field`, RESOURCE_FIELD_HINTS[field_name]);
	}

	if (handled_fields.size === 0) {
		push_error(
			repo_root,
			errors,
			file_path,
			"invalid resource frontmatter",
			"Ensure docs/resources frontmatter matches docs/resources/TEMPLATE.md and uses valid YAML scalar/list types.",
		);
	}
}

// Mirror resource error-mapping style for skill frontmatter consistency.
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
