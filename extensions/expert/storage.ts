import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
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

function parse_expertise_header(raw: string, domain_fallback: string): ExpertiseHeader {
	try {
		const parsed = YAML.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== "object") {
			return make_empty_header(domain_fallback);
		}

		const scope_raw = parsed.scope as Record<string, unknown> | undefined;

		return {
			domain: typeof parsed.domain === "string" ? parsed.domain : domain_fallback,
			description: typeof parsed.description === "string" ? parsed.description : "",
			last_synced: typeof parsed.last_synced === "string" ? parsed.last_synced : "",
			scope: {
				paths: Array.isArray(scope_raw?.paths)
					? (scope_raw.paths as unknown[]).filter((p): p is string => typeof p === "string")
					: [],
				patterns: Array.isArray(scope_raw?.patterns)
					? (scope_raw.patterns as unknown[]).filter((p): p is string => typeof p === "string")
					: undefined,
			},
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
		const parsed = JSON.parse(raw) as Partial<ExpertiseSettings>;
		return normalize_settings(parsed);
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function normalize_settings(raw: Partial<ExpertiseSettings>): ExpertiseSettings {
	return {
		auto_inject: raw.auto_inject ?? DEFAULT_SETTINGS.auto_inject,
		reflection_model:
			typeof raw.reflection_model === "string" ? raw.reflection_model : DEFAULT_SETTINGS.reflection_model,
		max_inject_domains: Number.isFinite(raw.max_inject_domains)
			? Math.max(1, Math.floor(raw.max_inject_domains!))
			: DEFAULT_SETTINGS.max_inject_domains,
	};
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
