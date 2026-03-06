import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

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
];

const SKILL_REQUIRED_FIELDS = ["name", "description"];

const MIN_EXTENSION_README_WORDS = 80;
const MIN_EXTENSION_README_HEADINGS = 3;

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
				"add YAML frontmatter between leading --- markers",
			);
			continue;
		}

		const fields = parse_frontmatter_fields(frontmatter);
		for (const field_name of RESOURCE_REQUIRED_FIELDS) {
			if (!has_value(fields[field_name])) {
				push_error(
					repo_root,
					errors,
					file_path,
					`missing required frontmatter field: ${field_name}`,
					`add a non-empty '${field_name}' value in frontmatter`,
				);
			}
		}

		if (has_value(fields.url) && !/^https?:\/\/\S+/u.test(normalize_value(fields.url))) {
			push_error(repo_root, errors, file_path, "invalid url field", "set 'url' to a full http(s) URL");
		}

		if (has_value(fields.date_captured) && !/^\d{4}-\d{2}-\d{2}$/u.test(normalize_value(fields.date_captured))) {
			push_error(repo_root, errors, file_path, "invalid date_captured format", "use YYYY-MM-DD for date_captured");
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
			push_error(repo_root, errors, file_path, "missing SKILL.md", "add SKILL.md with required frontmatter fields");
			continue;
		}

		const frontmatter = extract_frontmatter(file_content);
		if (!frontmatter) {
			push_error(
				repo_root,
				errors,
				file_path,
				"missing frontmatter block",
				"add YAML frontmatter between leading --- markers",
			);
			continue;
		}

		const fields = parse_frontmatter_fields(frontmatter);
		for (const field_name of SKILL_REQUIRED_FIELDS) {
			if (!has_value(fields[field_name])) {
				push_error(
					repo_root,
					errors,
					file_path,
					`missing required frontmatter field: ${field_name}`,
					`add a non-empty '${field_name}' value in frontmatter`,
				);
			}
		}

		if (has_value(fields.name)) {
			const normalized_name = normalize_value(fields.name).replace(/^"|"$/gu, "").replace(/^'|'$/gu, "");
			if (normalized_name !== expected_name) {
				push_error(
					repo_root,
					errors,
					file_path,
					`frontmatter name '${normalized_name}' does not match directory name '${expected_name}'`,
					"align SKILL frontmatter name with the skill directory name",
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
				"add README.md documenting behavior, usage, and requirements",
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
				"expand README with concrete behavior, triggers, and setup/troubleshooting notes",
			);
		}

		if (headings.length < MIN_EXTENSION_README_HEADINGS) {
			push_error(
				repo_root,
				errors,
				readme_path,
				`README has insufficient structure (${headings.length} headings; minimum ${MIN_EXTENSION_README_HEADINGS})`,
				"add markdown sections (e.g. Behavior, Usage, Requirements) to keep docs scannable",
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

function parse_frontmatter_fields(frontmatter: string): Record<string, string> {
	const lines = frontmatter.split(/\r?\n/u);
	const fields: Record<string, string> = {};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const key_match = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/u);
		if (!key_match) {
			continue;
		}

		const field_name = key_match[1];
		let field_value = key_match[2].trim();
		const uses_block_scalar = /^[>|][+-]?$/u.test(field_value);

		if (field_value.length === 0 || uses_block_scalar) {
			const multiline_lines: string[] = [];
			let cursor = index + 1;
			while (cursor < lines.length && !/^[a-zA-Z0-9_]+:\s*/u.test(lines[cursor])) {
				multiline_lines.push(lines[cursor]);
				cursor += 1;
			}
			field_value = multiline_lines.join("\n").trim();
			index = cursor - 1;
		}

		fields[field_name] = field_value;
	}

	return fields;
}

function has_value(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	const normalized = normalize_value(value);
	if (normalized.length === 0) {
		return false;
	}

	if (normalized === "[]" || normalized === "{}" || normalized === "|" || normalized === ">") {
		return false;
	}

	return true;
}

function normalize_value(value: string): string {
	return value.trim();
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
