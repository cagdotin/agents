import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import {
	DEFAULT_SETTINGS,
	EXPERTISE_DIR_NAME,
	EXPERTISE_PATH_ENV,
	REFLECTIONS_LOG_NAME,
	SETTINGS_FILE_NAME,
} from "./constants.js";
import type { ExpertiseHeader, ExpertiseRecord, ExpertiseSettings, ReflectionLogEntry } from "./types.js";

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

function get_reflections_log_path(dir: string): string {
	return path.join(dir, REFLECTIONS_LOG_NAME);
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
		keywords: optional_string_list_schema,
		aliases: optional_string_list_schema,
		related_domains: optional_string_list_schema,
	})
	.passthrough();

const reflection_log_entry_schema = z.object({
	date: z.string(),
	domain: z.string(),
	session: z.string(),
	model: z.string(),
	summary: z.string(),
});

const expertise_settings_schema = z
	.object({
		auto_inject: z.preprocess((value) => (typeof value === "boolean" ? value : undefined), z.boolean().optional()),
		reflection_model: z.preprocess((value) => (typeof value === "string" ? value : undefined), z.string().optional()),
		max_inject_domains: z.preprocess(
			(value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined),
			z.number().finite().optional(),
		),
		max_context_percent_for_auto_inject: z.preprocess(
			(value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined),
			z.number().finite().optional(),
		),
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
			keywords: data.keywords && data.keywords.length > 0 ? data.keywords : undefined,
			aliases: data.aliases && data.aliases.length > 0 ? data.aliases : undefined,
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
	if (!existsSync(file_path)) return null;

	const raw = await fs.readFile(file_path, "utf8");
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
	if (!existsSync(file_path)) return false;
	await fs.unlink(file_path);
	return true;
}

export async function list_domains(dir: string): Promise<ExpertiseHeader[]> {
	if (!existsSync(dir)) return [];

	const entries = await fs.readdir(dir);
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
		keywords: [],
		aliases: [],
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
	const max_context_percent_for_auto_inject = normalize_context_percent(
		raw.max_context_percent_for_auto_inject,
		DEFAULT_SETTINGS.max_context_percent_for_auto_inject,
	);
	const raw_any_inject_threshold = normalize_context_percent(
		raw.max_context_percent_for_any_inject,
		DEFAULT_SETTINGS.max_context_percent_for_any_inject,
	);

	return {
		auto_inject: raw.auto_inject ?? DEFAULT_SETTINGS.auto_inject,
		reflection_model:
			typeof raw.reflection_model === "string" ? raw.reflection_model : DEFAULT_SETTINGS.reflection_model,
		max_inject_domains: Number.isFinite(raw.max_inject_domains)
			? Math.max(1, Math.floor(raw.max_inject_domains!))
			: DEFAULT_SETTINGS.max_inject_domains,
		max_context_percent_for_auto_inject,
		max_context_percent_for_any_inject: Math.max(max_context_percent_for_auto_inject, raw_any_inject_threshold),
	};
}

function normalize_context_percent(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(1, Math.min(100, Math.floor(value)));
}

// ---------------------------------------------------------------------------
// Reflection log
// ---------------------------------------------------------------------------

export async function append_reflection_log(dir: string, entry: ReflectionLogEntry): Promise<void> {
	await ensure_expertise_dir(dir);
	const log_path = get_reflections_log_path(dir);

	const separator = "---\n";
	const yaml_entry = YAML.stringify(entry, { lineWidth: 120 });
	const block = `${separator}${yaml_entry}`;

	await fs.appendFile(log_path, block, "utf8");
}

export interface ReflectionLogReadResult {
	entries: ReflectionLogEntry[];
	skipped_entries: number;
}

export async function read_reflection_log(
	dir: string,
	options?: { domain?: string; limit?: number },
): Promise<ReflectionLogReadResult> {
	const log_path = get_reflections_log_path(dir);
	if (!existsSync(log_path)) {
		return { entries: [], skipped_entries: 0 };
	}

	const raw = await fs.readFile(log_path, "utf8");
	const docs = raw.split(/^---\s*$/gm);

	const parsed_entries: ReflectionLogEntry[] = [];
	let skipped_entries = 0;

	for (const doc of docs) {
		const trimmed = doc.trim();
		if (!trimmed) continue;

		try {
			const parsed = YAML.parse(trimmed);
			const entry = to_reflection_log_entry(parsed);
			if (!entry) {
				skipped_entries++;
				continue;
			}
			parsed_entries.push(entry);
		} catch {
			skipped_entries++;
		}
	}

	const domain_filter = options?.domain?.trim();
	const filtered_entries = domain_filter
		? parsed_entries.filter((entry) => entry.domain === domain_filter)
		: parsed_entries;

	const sorted_entries = filtered_entries.sort((a, b) => b.date.localeCompare(a.date));
	const limited_entries =
		typeof options?.limit === "number" && Number.isFinite(options.limit)
			? sorted_entries.slice(0, Math.max(1, Math.floor(options.limit)))
			: sorted_entries;

	return {
		entries: limited_entries,
		skipped_entries,
	};
}

function to_reflection_log_entry(parsed: unknown): ReflectionLogEntry | null {
	const validated_entry = reflection_log_entry_schema.safeParse(parsed);
	if (!validated_entry.success) {
		return null;
	}

	return validated_entry.data;
}
