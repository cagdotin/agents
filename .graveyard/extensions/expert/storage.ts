import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { DEFAULT_SETTINGS, EXPERTISE_DIR_NAME, EXPERTISE_PATH_ENV, SETTINGS_FILE_NAME } from "./constants.js";
import type { ExpertiseHeader, ExpertiseRecord, ExpertiseSettings } from "./types.js";

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

export function get_expertise_dir(cwd: string): string {
	const override = process.env[EXPERTISE_PATH_ENV];
	if (override?.trim()) {
		return path.resolve(cwd, override.trim());
	}
	return path.resolve(cwd, EXPERTISE_DIR_NAME);
}

export function get_expertise_dir_label(cwd: string): string {
	const override = process.env[EXPERTISE_PATH_ENV];
	if (override?.trim()) {
		return path.resolve(cwd, override.trim());
	}
	return EXPERTISE_DIR_NAME;
}

export async function ensure_expertise_dir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

function get_domain_path(dir: string, domain: string): string {
	return path.join(dir, `${domain}.yaml`);
}

function get_settings_path(dir: string): string {
	return path.join(dir, SETTINGS_FILE_NAME);
}

// ---------------------------------------------------------------------------
// YAML parsing — extract header fields from raw YAML
// ---------------------------------------------------------------------------

const required_string_list_schema = z.preprocess(
	(value) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []),
	z.array(z.string()),
);

const optional_string_list_schema = z.preprocess(
	(value) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : undefined),
	z.array(z.string()).optional(),
);

const expertise_scope_schema = z
	.object({
		paths: required_string_list_schema,
		patterns: optional_string_list_schema,
	})
	.passthrough();

const expertise_header_yaml_schema = z
	.object({
		domain: z.string().optional(),
		description: z.string().optional(),
		last_synced: z.string().optional(),
		scope: expertise_scope_schema.optional(),
		related_domains: optional_string_list_schema,
	})
	.passthrough();

const expertise_settings_schema = z
	.object({
		max_context_percent_for_any_inject: z.preprocess(
			(value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined),
			z.number().finite().optional(),
		),
	})
	.passthrough();

function parse_expertise_header(raw: string, domain_fallback: string): ExpertiseHeader {
	try {
		const parsed = YAML.parse(raw);
		const parsed_header = expertise_header_yaml_schema.safeParse(parsed);
		if (!parsed_header.success) {
			return make_empty_header(domain_fallback);
		}

		const data = parsed_header.data;
		const scope = data.scope ?? { paths: [] };

		return {
			domain: data.domain ?? domain_fallback,
			description: data.description ?? "",
			last_synced: data.last_synced ?? "",
			scope: {
				paths: scope.paths,
				patterns: scope.patterns && scope.patterns.length > 0 ? scope.patterns : undefined,
			},
			related_domains: data.related_domains && data.related_domains.length > 0 ? data.related_domains : undefined,
		};
	} catch {
		return make_empty_header(domain_fallback);
	}
}

function make_empty_header(domain: string): ExpertiseHeader {
	return {
		domain,
		description: "",
		last_synced: "",
		scope: { paths: [] },
	};
}

// ---------------------------------------------------------------------------
// Read / write expertise files
// ---------------------------------------------------------------------------

export async function read_expertise(dir: string, domain: string): Promise<ExpertiseRecord | null> {
	const file_path = get_domain_path(dir, domain);

	let raw: string;
	try {
		raw = await fs.readFile(file_path, "utf8");
	} catch {
		return null;
	}

	const header = parse_expertise_header(raw, domain);
	return { ...header, raw };
}

export async function write_expertise(dir: string, domain: string, content: string): Promise<void> {
	await ensure_expertise_dir(dir);
	const file_path = get_domain_path(dir, domain);
	await fs.writeFile(file_path, content, "utf8");
}

export async function delete_expertise(dir: string, domain: string): Promise<boolean> {
	const file_path = get_domain_path(dir, domain);
	try {
		await fs.unlink(file_path);
		return true;
	} catch {
		return false;
	}
}

export async function list_domains(dir: string): Promise<ExpertiseHeader[]> {
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch {
		return [];
	}
	const domains: ExpertiseHeader[] = [];

	for (const entry of entries) {
		if (!entry.endsWith(".yaml")) continue;
		const domain = entry.slice(0, -5);
		const file_path = path.join(dir, entry);

		try {
			const raw = await fs.readFile(file_path, "utf8");
			const header = parse_expertise_header(raw, domain);
			domains.push(header);
		} catch {
			// skip unreadable files
		}
	}

	return domains.sort((a, b) => a.domain.localeCompare(b.domain));
}

// ---------------------------------------------------------------------------
// Skeleton YAML for init
// ---------------------------------------------------------------------------

export function build_skeleton_yaml(domain: string, description: string, scope_paths: string[]): string {
	const doc: Record<string, unknown> = {
		domain,
		description,
		last_synced: new Date().toISOString(),
		scope: {
			paths: scope_paths,
		},
		related_domains: [],
		overview: "",
		patterns: [],
		gotchas: [],
		design_decisions: [],
		references: [],
	};

	return YAML.stringify(doc, { lineWidth: 120 });
}

// ---------------------------------------------------------------------------
// Append to section — add a single item to a YAML list section
// ---------------------------------------------------------------------------

export async function append_to_section(
	dir: string,
	domain: string,
	section: string,
	content: string,
): Promise<{ error?: string }> {
	const file_path = get_domain_path(dir, domain);

	let raw: string;
	try {
		raw = await fs.readFile(file_path, "utf8");
	} catch {
		return { error: `Domain '${domain}' not found. Use 'init' to create it.` };
	}

	let parsed: Record<string, unknown>;
	try {
		parsed = YAML.parse(raw);
		if (!parsed || typeof parsed !== "object") {
			return { error: "Failed to parse expertise YAML" };
		}
	} catch {
		return { error: "Failed to parse expertise YAML" };
	}

	const existing_value = parsed[section];

	if (existing_value === undefined || existing_value === null || existing_value === "") {
		// Section doesn't exist or is empty — create it as a new list
		parsed[section] = [content];
	} else if (Array.isArray(existing_value)) {
		existing_value.push(content);
	} else {
		return { error: `Section '${section}' is not a list. Use 'update' for full replacement.` };
	}

	// Update last_synced
	parsed.last_synced = new Date().toISOString();

	const updated_yaml = YAML.stringify(parsed, { lineWidth: 120 });
	await fs.writeFile(file_path, updated_yaml, "utf8");

	return {};
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function read_settings(dir: string): Promise<ExpertiseSettings> {
	const settings_path = get_settings_path(dir);

	try {
		const raw = await fs.readFile(settings_path, "utf8");
		const parsed = JSON.parse(raw);
		const validated_settings = expertise_settings_schema.safeParse(parsed);
		if (!validated_settings.success) {
			return { ...DEFAULT_SETTINGS };
		}
		return normalize_settings(validated_settings.data);
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function normalize_settings(raw: Partial<ExpertiseSettings>): ExpertiseSettings {
	return {
		max_context_percent_for_any_inject: normalize_context_percent(
			raw.max_context_percent_for_any_inject,
			DEFAULT_SETTINGS.max_context_percent_for_any_inject,
		),
	};
}

function normalize_context_percent(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(1, Math.min(100, Math.floor(value)));
}
