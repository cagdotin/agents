import { existsSync, readdirSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	TRACK_DIRECTORY_NAMES,
	TRACK_METADATA_FILE_NAME,
	TRACK_REGENERATABLE_TEMPLATE_FILE_NAMES,
	TRACK_REQUIRED_FILE_NAMES,
	TRACK_SETTINGS_FILE_NAME,
	TRACK_SUMMARY_VERSION,
	TRACKS_DIR_NAME,
} from "./constants.js";
import {
	type TrackMetadata,
	type TrackRecord,
	type TrackSettings,
	track_metadata_schema,
	track_settings_schema,
} from "./types.js";

const module_dir = path.dirname(fileURLToPath(import.meta.url));

export function get_tracks_dir(cwd: string): string {
	return path.resolve(cwd, TRACKS_DIR_NAME);
}

export function get_tracks_dir_label(): string {
	return TRACKS_DIR_NAME;
}

export function get_track_settings_path(tracks_dir: string): string {
	return path.join(tracks_dir, TRACK_SETTINGS_FILE_NAME);
}

export function get_track_dir(tracks_dir: string, slug: string): string {
	return path.join(tracks_dir, slug);
}

export function get_track_metadata_path(track_dir: string): string {
	return path.join(track_dir, TRACK_METADATA_FILE_NAME);
}

export function get_track_template_dir(): string {
	return path.join(module_dir, "templates");
}

export function normalize_track_slug(name: string): string {
	const trimmed = name.trim().replace(/^@+/, "");
	const slug = trimmed
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);

	if (!slug) {
		throw new Error("Track name is required. Use a short slug-like name such as 'docs-refresh'.");
	}

	return slug;
}

export async function ensure_tracks_dir(tracks_dir: string): Promise<void> {
	await fs.mkdir(tracks_dir, { recursive: true });
}

export async function ensure_track_settings_file(tracks_dir: string): Promise<void> {
	await ensure_tracks_dir(tracks_dir);
	const settings_path = get_track_settings_path(tracks_dir);
	if (!existsSync(settings_path)) {
		await fs.writeFile(settings_path, `${JSON.stringify({}, null, 2)}\n`, "utf8");
	}
}

export async function read_track_settings(tracks_dir: string): Promise<TrackSettings> {
	await ensure_tracks_dir(tracks_dir);
	const settings_path = get_track_settings_path(tracks_dir);

	try {
		const raw = await fs.readFile(settings_path, "utf8");
		const parsed = JSON.parse(raw);
		const validated = track_settings_schema.safeParse(parsed);
		if (!validated.success) {
			return {};
		}
		return validated.data;
	} catch {
		// Settings file missing or malformed — use defaults
		return {};
	}
}

export async function write_track_settings(tracks_dir: string, settings: TrackSettings): Promise<void> {
	await ensure_tracks_dir(tracks_dir);
	const settings_path = get_track_settings_path(tracks_dir);
	const next_settings = settings.active_track ? { active_track: settings.active_track } : {};
	await fs.writeFile(settings_path, `${JSON.stringify(next_settings, null, 2)}\n`, "utf8");
}

export async function set_active_track(tracks_dir: string, slug: string): Promise<void> {
	await write_track_settings(tracks_dir, { active_track: slug });
}

export async function clear_active_track(tracks_dir: string): Promise<void> {
	await write_track_settings(tracks_dir, {});
}

export async function get_active_track(tracks_dir: string): Promise<string | undefined> {
	const settings = await read_track_settings(tracks_dir);
	return settings.active_track;
}

function yaml_quote(value: string): string {
	if (!value) return '""';
	if (
		/[:#[\]{},"'|>&*!?%@`\n\r\\]/.test(value) ||
		value.trim() !== value ||
		/^(true|false|yes|no|on|off|null|~)$/i.test(value) ||
		/^[\d.+-]/.test(value)
	) {
		return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	}
	return value;
}

function yaml_unquote(value: string): string {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
	}
	return trimmed;
}

export function serialize_track_metadata(metadata: TrackMetadata): string {
	const lines: string[] = [];
	lines.push(`name: ${yaml_quote(metadata.name)}`);
	lines.push(`purpose: ${yaml_quote(metadata.purpose)}`);
	lines.push(`status: ${metadata.status}`);
	lines.push(`created_at: ${yaml_quote(metadata.created_at)}`);
	lines.push(`updated_at: ${yaml_quote(metadata.updated_at)}`);
	lines.push(`last_synced_at: ${yaml_quote(metadata.last_synced_at)}`);
	if (typeof metadata.session_count === "number") {
		lines.push(`session_count: ${metadata.session_count}`);
	}
	if (metadata.closed_at) {
		lines.push(`closed_at: ${yaml_quote(metadata.closed_at)}`);
	}
	lines.push(`summary_version: ${metadata.summary_version ?? TRACK_SUMMARY_VERSION}`);
	if (metadata.related_paths.length === 0) {
		lines.push("related_paths: []");
	} else {
		lines.push("related_paths:");
		for (const related_path of metadata.related_paths) {
			lines.push(`  - ${yaml_quote(related_path)}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

/**
 * Minimal YAML parser for flat key-value pairs and simple string arrays.
 * Does NOT handle: nested objects, multi-line block scalars (| or >),
 * inline arrays ([a, b, c]), or comments after values.
 * Sufficient for TrackMetadata — switch to a real YAML parser if the schema grows.
 */
function parse_track_metadata_yaml(raw: string): Record<string, unknown> {
	const data: Record<string, unknown> = {};
	const lines = raw.split(/\r?\n/);
	let current_array_key: string | null = null;

	for (const raw_line of lines) {
		const line = raw_line.trimEnd();
		if (!line.trim() || line.trimStart().startsWith("#")) {
			continue;
		}

		if (current_array_key && /^\s*-\s+/.test(line)) {
			const current = Array.isArray(data[current_array_key]) ? (data[current_array_key] as string[]) : [];
			current.push(yaml_unquote(line.replace(/^\s*-\s+/, "")));
			data[current_array_key] = current;
			continue;
		}

		current_array_key = null;
		const colon_index = line.indexOf(":");
		if (colon_index === -1) {
			continue;
		}

		const key = line.slice(0, colon_index).trim();
		const raw_value = line.slice(colon_index + 1).trim();
		if (!raw_value) {
			current_array_key = key;
			data[key] = [];
			continue;
		}
		if (raw_value === "[]") {
			data[key] = [];
			continue;
		}

		const value = yaml_unquote(raw_value);
		if (key === "session_count" || key === "summary_version") {
			const numeric_value = Number.parseInt(value, 10);
			data[key] = Number.isFinite(numeric_value) ? numeric_value : value;
			continue;
		}

		data[key] = value;
	}

	return data;
}

function map_track_metadata_error(
	track_dir: string,
	issues: Array<{ path: Array<string | number>; message: string }>,
): Error {
	const details = issues
		.map((issue) => {
			const key = issue.path.length > 0 ? issue.path.join(".") : "track metadata";
			return `${key}: ${issue.message}`;
		})
		.join("; ");

	return new Error(
		`Track metadata is invalid at ${path.join(track_dir, TRACK_METADATA_FILE_NAME)}. ` +
			`${details}. Fix ${TRACK_METADATA_FILE_NAME} or regenerate the workspace with /track sync.`,
	);
}

export function parse_track_metadata(raw: string, track_dir: string): TrackMetadata {
	const parsed = parse_track_metadata_yaml(raw);
	const validated = track_metadata_schema.safeParse(parsed);
	if (!validated.success) {
		throw map_track_metadata_error(track_dir, validated.error.issues);
	}
	return validated.data;
}

export async function read_track_metadata(track_dir: string): Promise<TrackMetadata> {
	const metadata_path = get_track_metadata_path(track_dir);
	const raw = await fs.readFile(metadata_path, "utf8");
	return parse_track_metadata(raw, track_dir);
}

export function read_track_metadata_sync(track_dir: string): TrackMetadata {
	const metadata_path = get_track_metadata_path(track_dir);
	const raw = readFileSync(metadata_path, "utf8");
	return parse_track_metadata(raw, track_dir);
}

export async function write_track_metadata(track_dir: string, metadata: TrackMetadata): Promise<void> {
	const metadata_path = get_track_metadata_path(track_dir);
	await fs.writeFile(metadata_path, serialize_track_metadata(metadata), "utf8");
}

export async function update_track_metadata(
	track_dir: string,
	updater: (metadata: TrackMetadata) => TrackMetadata,
): Promise<TrackMetadata> {
	const current = await read_track_metadata(track_dir);
	const next = updater(current);
	await write_track_metadata(track_dir, next);
	return next;
}

export async function read_track_file(track_dir: string, file_name: string): Promise<string> {
	return fs.readFile(path.join(track_dir, file_name), "utf8");
}

export async function write_track_file(track_dir: string, file_name: string, content: string): Promise<void> {
	await fs.writeFile(path.join(track_dir, file_name), content, "utf8");
}

export function list_missing_track_files(track_dir: string): string[] {
	return TRACK_REQUIRED_FILE_NAMES.filter((file_name) => !existsSync(path.join(track_dir, file_name)));
}

async function read_template_file(file_name: string): Promise<string> {
	return fs.readFile(path.join(get_track_template_dir(), file_name), "utf8");
}

function render_template(template: string, metadata: TrackMetadata, slug: string): string {
	return template
		.replaceAll("{{TRACK_NAME}}", metadata.name)
		.replaceAll("{{TRACK_SLUG}}", slug)
		.replaceAll("{{TRACK_PURPOSE}}", metadata.purpose);
}

export async function regenerate_missing_track_files(track_dir: string, metadata: TrackMetadata): Promise<string[]> {
	const regenerated: string[] = [];
	const slug = path.basename(track_dir);

	for (const file_name of TRACK_REGENERATABLE_TEMPLATE_FILE_NAMES) {
		const file_path = path.join(track_dir, file_name);
		if (existsSync(file_path)) {
			continue;
		}
		const template = await read_template_file(file_name);
		await fs.writeFile(file_path, render_template(template, metadata, slug), "utf8");
		regenerated.push(file_name);
	}

	for (const directory_name of TRACK_DIRECTORY_NAMES) {
		await fs.mkdir(path.join(track_dir, directory_name), { recursive: true });
	}

	return regenerated;
}

export async function create_track_workspace(args: {
	tracks_dir: string;
	name: string;
	purpose: string;
	related_paths?: string[];
}): Promise<TrackRecord> {
	await ensure_tracks_dir(args.tracks_dir);

	const slug = normalize_track_slug(args.name);
	const track_dir = get_track_dir(args.tracks_dir, slug);
	if (existsSync(track_dir)) {
		throw new Error(`Track '${slug}' already exists. Use /track use ${slug} or choose a different name.`);
	}

	const now = new Date().toISOString();
	const metadata: TrackMetadata = {
		name: slug,
		purpose: args.purpose.trim(),
		status: "active",
		created_at: now,
		updated_at: now,
		last_synced_at: now,
		related_paths: [...(args.related_paths ?? [])],
		session_count: 0,
		summary_version: TRACK_SUMMARY_VERSION,
	};

	await fs.mkdir(track_dir, { recursive: false });

	try {
		for (const file_name of TRACK_REGENERATABLE_TEMPLATE_FILE_NAMES) {
			const template = await read_template_file(file_name);
			await fs.writeFile(path.join(track_dir, file_name), render_template(template, metadata, slug), "utf8");
		}
		for (const directory_name of TRACK_DIRECTORY_NAMES) {
			await fs.mkdir(path.join(track_dir, directory_name), { recursive: true });
		}
		await write_track_metadata(track_dir, metadata);
		return {
			slug,
			dir: track_dir,
			metadata,
			missing_files: list_missing_track_files(track_dir),
			is_active: false,
		};
	} catch (error) {
		await fs.rm(track_dir, { recursive: true, force: true });
		throw error;
	}
}

export async function read_track_record(tracks_dir: string, name_or_slug: string): Promise<TrackRecord> {
	const slug = normalize_track_slug(name_or_slug);
	const track_dir = get_track_dir(tracks_dir, slug);
	if (!existsSync(track_dir)) {
		throw new Error(`Track '${slug}' not found. Use /track list to inspect available tracks.`);
	}

	const metadata = await read_track_metadata(track_dir);
	const active_track = await get_active_track(tracks_dir);
	return {
		slug,
		dir: track_dir,
		metadata,
		missing_files: list_missing_track_files(track_dir),
		is_active: active_track === slug,
	};
}

function read_track_record_sync(tracks_dir: string, slug: string): TrackRecord | null {
	const track_dir = get_track_dir(tracks_dir, slug);
	if (!existsSync(track_dir)) {
		return null;
	}

	try {
		const metadata = read_track_metadata_sync(track_dir);
		return {
			slug,
			dir: track_dir,
			metadata,
			missing_files: list_missing_track_files(track_dir),
			is_active: false,
		};
	} catch {
		// Metadata missing or malformed — treat track as unreadable
		return null;
	}
}

export async function list_tracks(tracks_dir: string): Promise<TrackRecord[]> {
	await ensure_tracks_dir(tracks_dir);
	const active_track = await get_active_track(tracks_dir);

	let entries: string[] = [];
	try {
		entries = await fs.readdir(tracks_dir);
	} catch {
		// Tracks directory unreadable — return empty list
		return [];
	}

	const tracks: TrackRecord[] = [];
	for (const entry of entries.sort()) {
		if (entry === TRACK_SETTINGS_FILE_NAME) continue;
		const track_dir = path.join(tracks_dir, entry);
		let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
		try {
			stat = await fs.stat(track_dir);
		} catch {
			// Entry unreadable — skip
			stat = null;
		}
		if (!stat?.isDirectory()) continue;
		try {
			const metadata = await read_track_metadata(track_dir);
			tracks.push({
				slug: entry,
				dir: track_dir,
				metadata,
				missing_files: list_missing_track_files(track_dir),
				is_active: active_track === entry,
			});
		} catch (error) {
			console.warn(`Skipping track '${entry}': ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return tracks.sort((left, right) => left.slug.localeCompare(right.slug));
}

export function list_tracks_sync(tracks_dir: string): TrackRecord[] {
	let active_track: string | undefined;
	const settings_path = get_track_settings_path(tracks_dir);
	if (existsSync(settings_path)) {
		try {
			const validated = track_settings_schema.safeParse(JSON.parse(readFileSync(settings_path, "utf8")));
			active_track = validated.success ? validated.data.active_track : undefined;
		} catch {
			// Settings file malformed — no active track
			active_track = undefined;
		}
	}

	let entries: string[] = [];
	try {
		entries = readdirSync(tracks_dir);
	} catch {
		// Tracks directory unreadable — return empty list
		return [];
	}

	const tracks: TrackRecord[] = [];
	for (const entry of entries.sort()) {
		if (entry === TRACK_SETTINGS_FILE_NAME) continue;
		const record = read_track_record_sync(tracks_dir, entry);
		if (!record) continue;
		record.is_active = active_track === entry;
		tracks.push(record);
	}
	return tracks;
}

export async function increment_track_session_count(track_dir: string): Promise<TrackMetadata> {
	return update_track_metadata(track_dir, (metadata) => ({
		...metadata,
		session_count: (metadata.session_count ?? 0) + 1,
		updated_at: new Date().toISOString(),
	}));
}
