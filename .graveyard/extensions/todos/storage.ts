import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { z } from "zod";
import {
	DEFAULT_TODO_SETTINGS,
	LOCK_TTL_MS,
	TODO_DIR_NAME,
	TODO_ID_PATTERN,
	TODO_PATH_ENV,
	TODO_SETTINGS_NAME,
} from "./constants.js";
import {
	clear_assignment_if_closed,
	display_todo_id,
	is_todo_closed,
	sort_todos,
	validate_todo_id,
} from "./helpers.js";
import type { LockInfo, TodoFrontMatter, TodoRecord, TodoSettings } from "./types.js";

// ---------------------------------------------------------------------------
// Directory / path helpers
// ---------------------------------------------------------------------------

export function get_todos_dir(cwd: string): string {
	const override_path = process.env[TODO_PATH_ENV];
	if (override_path?.trim()) {
		return path.resolve(cwd, override_path.trim());
	}
	return path.resolve(cwd, TODO_DIR_NAME);
}

export function get_todos_dir_label(cwd: string): string {
	const override_path = process.env[TODO_PATH_ENV];
	if (override_path?.trim()) {
		return path.resolve(cwd, override_path.trim());
	}
	return TODO_DIR_NAME;
}

/** @deprecated Use find_todo_path_by_id() for lookups or build_todo_path() for new files. */
export function get_todo_path(todos_dir: string, id: string): string {
	return path.join(todos_dir, `${id}.md`);
}

// ---------------------------------------------------------------------------
// Title-based filename helpers
// ---------------------------------------------------------------------------

export function title_to_slug(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return slug || "untitled";
}

export function build_todo_path(todos_dir: string, title: string): string {
	const base_slug = title_to_slug(title);
	let slug = base_slug;
	let counter = 2;
	while (existsSync(path.join(todos_dir, `${slug}.md`))) {
		slug = `${base_slug}-${counter}`;
		counter += 1;
	}
	return path.join(todos_dir, `${slug}.md`);
}

export async function find_todo_path_by_id(todos_dir: string, id: string): Promise<string | null> {
	let entries: string[];
	try {
		entries = await fs.readdir(todos_dir);
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const file_path = path.join(todos_dir, entry);
		try {
			const content = await fs.readFile(file_path, "utf8");
			const { front_matter } = split_front_matter(content);
			const parsed = parse_frontmatter(front_matter, "");
			if (parsed.id === id) return file_path;
		} catch {
			// ignore unreadable file
		}
	}
	return null;
}

export function find_todo_path_by_id_sync(todos_dir: string, id: string): string | null {
	let entries: string[];
	try {
		entries = readdirSync(todos_dir);
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const file_path = path.join(todos_dir, entry);
		try {
			const content = readFileSync(file_path, "utf8");
			const { front_matter } = split_front_matter(content);
			const parsed = parse_frontmatter(front_matter, "");
			if (parsed.id === id) return file_path;
		} catch {
			// ignore unreadable file
		}
	}
	return null;
}

export async function rename_todo_if_needed(
	todos_dir: string,
	current_path: string,
	new_title: string,
): Promise<string> {
	const new_slug = title_to_slug(new_title);
	const current_filename = path.basename(current_path, ".md");
	if (current_filename === new_slug) return current_path;

	let target_slug = new_slug;
	let counter = 2;
	while (true) {
		const target_path = path.join(todos_dir, `${target_slug}.md`);
		if (!existsSync(target_path) || target_path === current_path) {
			await fs.rename(current_path, target_path);
			return target_path;
		}
		target_slug = `${new_slug}-${counter}`;
		counter += 1;
	}
}

export async function migrate_todo_filenames(todos_dir: string): Promise<void> {
	let entries: string[];
	try {
		entries = await fs.readdir(todos_dir);
	} catch {
		return;
	}

	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const current_slug = entry.slice(0, -3);
		// Only migrate files that look like old hex-id filenames
		if (!TODO_ID_PATTERN.test(current_slug)) continue;
		const file_path = path.join(todos_dir, entry);
		try {
			const content = await fs.readFile(file_path, "utf8");
			const { front_matter } = split_front_matter(content);
			const parsed = parse_frontmatter(front_matter, current_slug);
			if (parsed.title) {
				const expected_slug = title_to_slug(parsed.title);
				if (current_slug !== expected_slug) {
					await rename_todo_if_needed(todos_dir, file_path, parsed.title);
				}
			}
		} catch {
			// ignore unreadable file
		}
	}
}

export function get_lock_path(todos_dir: string, id: string): string {
	return path.join(todos_dir, `${id}.lock`);
}

export function get_todo_settings_path(todos_dir: string): string {
	return path.join(todos_dir, TODO_SETTINGS_NAME);
}

export async function ensure_todos_dir(todos_dir: string) {
	await fs.mkdir(todos_dir, { recursive: true });
}

const todo_frontmatter_schema = z.object({
	id: z.string().min(1),
	title: z.string(),
	tags: z.array(z.string()),
	status: z.string().min(1),
	created_at: z.string(),
	assigned_to_session: z.preprocess(
		(value) => (typeof value === "string" && value.trim().length > 0 ? value : undefined),
		z.string().optional(),
	),
});

const todo_settings_schema = z
	.object({
		gc: z.preprocess((value) => (typeof value === "boolean" ? value : undefined), z.boolean().optional()),
		gc_days: z.preprocess(
			(value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined),
			z.number().finite().optional(),
		),
	})
	.passthrough();

const lock_info_schema = z.object({
	id: z.string().min(1),
	pid: z.number().int(),
	session: z.string().nullable().optional(),
	created_at: z.string().min(1),
});

// Legacy JSON frontmatter (older todo files) is tolerated and normalized before conversion.
const legacy_json_frontmatter_schema = z
	.object({
		id: z.preprocess(normalize_legacy_scalar_value, z.string().min(1).optional()),
		title: z.preprocess((value) => (typeof value === "string" ? value : undefined), z.string().optional()),
		tags: z.preprocess((value) => (Array.isArray(value) ? value : undefined), z.array(z.unknown()).optional()),
		status: z.preprocess(normalize_legacy_scalar_value, z.string().min(1).optional()),
		created_at: z.preprocess((value) => (typeof value === "string" ? value : undefined), z.string().optional()),
		assigned_to_session: z.preprocess(
			(value) => (typeof value === "string" && value.trim().length > 0 ? value : undefined),
			z.string().optional(),
		),
	})
	.passthrough();

// ---------------------------------------------------------------------------
// YAML frontmatter
// ---------------------------------------------------------------------------

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

function serialize_frontmatter(fm: TodoFrontMatter): string {
	const lines: string[] = ["---"];
	lines.push(`id: ${fm.id}`);
	lines.push(`title: ${yaml_quote(fm.title)}`);
	if (fm.tags.length === 0) {
		lines.push("tags: []");
	} else {
		lines.push("tags:");
		for (const tag of fm.tags) {
			lines.push(`  - ${yaml_quote(tag)}`);
		}
	}
	lines.push(`status: ${fm.status}`);
	lines.push(`created_at: ${yaml_quote(fm.created_at)}`);
	if (fm.assigned_to_session) {
		lines.push(`assigned_to_session: ${fm.assigned_to_session}`);
	}
	lines.push("---");
	return lines.join("\n");
}

function normalize_frontmatter(data: TodoFrontMatter, id_fallback: string): TodoFrontMatter {
	const validated = todo_frontmatter_schema.safeParse(data);
	if (validated.success) {
		return validated.data;
	}

	return {
		id: id_fallback,
		title: "",
		tags: [],
		status: "open",
		created_at: "",
		assigned_to_session: undefined,
	};
}

function parse_frontmatter(text: string, id_fallback: string): TodoFrontMatter {
	const data: TodoFrontMatter = {
		id: id_fallback,
		title: "",
		tags: [],
		status: "open",
		created_at: "",
		assigned_to_session: undefined,
	};

	const trimmed = text.trim();
	if (!trimmed) return normalize_frontmatter(data, id_fallback);

	let current_key: string | null = null;
	let collecting_array = false;

	for (const raw_line of trimmed.split("\n")) {
		const line = raw_line.trimEnd();

		// array item
		if (collecting_array && /^\s+-\s+/.test(line)) {
			const item_value = yaml_unquote(line.replace(/^\s+-\s+/, ""));
			if (current_key === "tags") {
				data.tags.push(item_value);
			}
			continue;
		}

		// stop collecting array when we hit a non-item line
		collecting_array = false;

		const colon_index = line.indexOf(":");
		if (colon_index === -1) continue;

		const key = line.slice(0, colon_index).trim();
		const raw_value = line.slice(colon_index + 1).trim();
		current_key = key;

		// inline empty array
		if (raw_value === "[]") {
			if (key === "tags") data.tags = [];
			continue;
		}

		// multiline array start (value is empty after colon)
		if (!raw_value) {
			collecting_array = true;
			if (key === "tags") data.tags = [];
			continue;
		}

		const value = yaml_unquote(raw_value);

		switch (key) {
			case "id":
				if (value) data.id = value;
				break;
			case "title":
				data.title = value;
				break;
			case "status":
				if (value) data.status = value;
				break;
			case "created_at":
				data.created_at = value;
				break;
			case "assigned_to_session":
				if (value.trim()) data.assigned_to_session = value;
				break;
		}
	}

	return normalize_frontmatter(data, id_fallback);
}

function split_front_matter(content: string): { front_matter: string; body: string } {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		// Legacy JSON frontmatter support
		if (trimmed.startsWith("{")) {
			return split_json_front_matter(trimmed);
		}
		return { front_matter: "", body: content };
	}

	const after_opening = trimmed.slice(3);
	const closing_index = after_opening.indexOf("\n---");
	if (closing_index === -1) {
		return { front_matter: "", body: content };
	}

	const front_matter = after_opening.slice(0, closing_index).trim();
	const body = after_opening.slice(closing_index + 4).replace(/^\r?\n+/, "");
	return { front_matter, body };
}

function find_json_object_end(content: string): number {
	let depth = 0;
	let in_string = false;
	let escaped = false;

	for (let i = 0; i < content.length; i += 1) {
		const char = content[i];

		if (in_string) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"') {
				in_string = false;
			}
			continue;
		}

		if (char === '"') {
			in_string = true;
			continue;
		}

		if (char === "{") {
			depth += 1;
			continue;
		}

		if (char === "}") {
			depth -= 1;
			if (depth === 0) return i;
		}
	}

	return -1;
}

// Preserve backward compatibility by accepting primitive legacy scalars.
function normalize_legacy_scalar_value(value: unknown): string | undefined {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	if (typeof value === "boolean") {
		return String(value);
	}
	return undefined;
}

function split_json_front_matter(content: string): { front_matter: string; body: string } {
	const end_index = find_json_object_end(content);
	if (end_index === -1) {
		return { front_matter: "", body: content };
	}

	const json_text = content.slice(0, end_index + 1);
	const body = content.slice(end_index + 1).replace(/^\r?\n+/, "");

	// Convert JSON frontmatter to parsed fields for the same parse_frontmatter path
	try {
		const parsed = JSON.parse(json_text);
		const legacy_frontmatter_result = legacy_json_frontmatter_schema.safeParse(parsed);
		if (!legacy_frontmatter_result.success) {
			return { front_matter: "", body: content };
		}

		const legacy_frontmatter = legacy_frontmatter_result.data;
		const yaml_lines: string[] = [];
		if (legacy_frontmatter.id) yaml_lines.push(`id: ${legacy_frontmatter.id}`);
		if (typeof legacy_frontmatter.title === "string") yaml_lines.push(`title: ${yaml_quote(legacy_frontmatter.title)}`);
		if (Array.isArray(legacy_frontmatter.tags)) {
			if (legacy_frontmatter.tags.length === 0) {
				yaml_lines.push("tags: []");
			} else {
				yaml_lines.push("tags:");
				for (const tag of legacy_frontmatter.tags) {
					yaml_lines.push(`  - ${yaml_quote(String(tag))}`);
				}
			}
		}
		if (legacy_frontmatter.status) yaml_lines.push(`status: ${legacy_frontmatter.status}`);
		if (typeof legacy_frontmatter.created_at === "string") {
			yaml_lines.push(`created_at: ${yaml_quote(legacy_frontmatter.created_at)}`);
		}
		if (typeof legacy_frontmatter.assigned_to_session === "string" && legacy_frontmatter.assigned_to_session.trim()) {
			yaml_lines.push(`assigned_to_session: ${legacy_frontmatter.assigned_to_session}`);
		}
		return { front_matter: yaml_lines.join("\n"), body };
	} catch {
		return { front_matter: "", body: content };
	}
}

// ---------------------------------------------------------------------------
// Todo file read / write
// ---------------------------------------------------------------------------

function parse_todo_content(content: string, id_fallback: string): TodoRecord {
	const { front_matter, body } = split_front_matter(content);
	const parsed = parse_frontmatter(front_matter, id_fallback);
	return {
		id: id_fallback,
		title: parsed.title,
		tags: parsed.tags ?? [],
		status: parsed.status,
		created_at: parsed.created_at,
		assigned_to_session: parsed.assigned_to_session,
		body: body ?? "",
	};
}

function serialize_todo(todo: TodoRecord): string {
	const fm: TodoFrontMatter = {
		id: todo.id,
		title: todo.title,
		tags: todo.tags ?? [],
		status: todo.status,
		created_at: todo.created_at,
		assigned_to_session: todo.assigned_to_session,
	};

	const header = serialize_frontmatter(fm);
	const body = todo.body ?? "";
	const trimmed_body = body.replace(/^\n+/, "").replace(/\s+$/, "");
	if (!trimmed_body) return `${header}\n`;
	return `${header}\n\n${trimmed_body}\n`;
}

export async function read_todo_file(file_path: string, id_fallback: string): Promise<TodoRecord> {
	const content = await fs.readFile(file_path, "utf8");
	return parse_todo_content(content, id_fallback);
}

export async function write_todo_file(file_path: string, todo: TodoRecord) {
	await fs.writeFile(file_path, serialize_todo(todo), "utf8");
}

export async function generate_todo_id(todos_dir: string): Promise<string> {
	const existing = await list_todos(todos_dir);
	const existing_ids = new Set(existing.map((t) => t.id));
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const id = crypto.randomBytes(4).toString("hex");
		if (!existing_ids.has(id)) return id;
	}
	throw new Error("Failed to generate unique todo id");
}

export async function ensure_todo_exists(file_path: string, id: string): Promise<TodoRecord | null> {
	if (!existsSync(file_path)) return null;
	return read_todo_file(file_path, id);
}

export async function append_todo_body(file_path: string, todo: TodoRecord, text: string): Promise<TodoRecord> {
	const spacer = todo.body.trim().length ? "\n\n" : "";
	todo.body = `${todo.body.replace(/\s+$/, "")}${spacer}${text.trim()}\n`;
	await write_todo_file(file_path, todo);
	return todo;
}

// ---------------------------------------------------------------------------
// Settings & garbage collection
// ---------------------------------------------------------------------------

function normalize_todo_settings(raw: Partial<TodoSettings>): TodoSettings {
	const gc = raw.gc ?? DEFAULT_TODO_SETTINGS.gc;
	const gc_days = Number.isFinite(raw.gc_days) ? raw.gc_days! : DEFAULT_TODO_SETTINGS.gc_days;
	return {
		gc: Boolean(gc),
		gc_days: Math.max(0, Math.floor(gc_days)),
	};
}

export async function read_todo_settings(todos_dir: string): Promise<TodoSettings> {
	const settings_path = get_todo_settings_path(todos_dir);
	let data: Partial<TodoSettings> = {};

	try {
		const raw = await fs.readFile(settings_path, "utf8");
		const parsed = JSON.parse(raw);
		const validated_settings = todo_settings_schema.safeParse(parsed);
		data = validated_settings.success ? validated_settings.data : {};
	} catch {
		data = {};
	}

	return normalize_todo_settings(data);
}

export async function garbage_collect_todos(todos_dir: string, settings: TodoSettings): Promise<void> {
	if (!settings.gc) return;

	let entries: string[] = [];
	try {
		entries = await fs.readdir(todos_dir);
	} catch {
		return;
	}

	const cutoff = Date.now() - settings.gc_days * 24 * 60 * 60 * 1000;
	await Promise.all(
		entries
			.filter((entry) => entry.endsWith(".md"))
			.map(async (entry) => {
				const filename_fallback = entry.slice(0, -3);
				const file_path = path.join(todos_dir, entry);
				try {
					const content = await fs.readFile(file_path, "utf8");
					const { front_matter } = split_front_matter(content);
					const parsed = parse_frontmatter(front_matter, filename_fallback);
					if (!is_todo_closed(parsed.status)) return;
					const created_at = Date.parse(parsed.created_at);
					if (!Number.isFinite(created_at)) return;
					if (created_at < cutoff) {
						await fs.unlink(file_path);
					}
				} catch {
					// ignore unreadable todo
				}
			}),
	);
}

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

async function read_lock_info(lock_path: string): Promise<LockInfo | null> {
	try {
		const raw = await fs.readFile(lock_path, "utf8");
		const parsed = JSON.parse(raw);
		const validated_lock = lock_info_schema.safeParse(parsed);
		if (!validated_lock.success) {
			return null;
		}
		return validated_lock.data;
	} catch {
		return null;
	}
}

export async function acquire_lock(
	todos_dir: string,
	id: string,
	ctx: ExtensionContext,
): Promise<(() => Promise<void>) | { error: string }> {
	const lock_path = get_lock_path(todos_dir, id);
	const now = Date.now();
	const session = ctx.sessionManager.getSessionFile();

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const handle = await fs.open(lock_path, "wx");
			const info: LockInfo = {
				id,
				pid: process.pid,
				session,
				created_at: new Date(now).toISOString(),
			};
			await handle.writeFile(JSON.stringify(info, null, 2), "utf8");
			await handle.close();
			return async () => {
				try {
					await fs.unlink(lock_path);
				} catch {
					// ignore
				}
			};
		} catch (error: any) {
			if (error?.code !== "EEXIST") {
				return { error: `Failed to acquire lock: ${error?.message ?? "unknown error"}` };
			}
			const stats = await fs.stat(lock_path).catch(() => null);
			const lock_age = stats ? now - stats.mtimeMs : LOCK_TTL_MS + 1;
			if (lock_age <= LOCK_TTL_MS) {
				const info = await read_lock_info(lock_path);
				const owner = info?.session ? ` (session ${info.session})` : "";
				return { error: `Todo ${display_todo_id(id)} is locked${owner}. Try again later.` };
			}
			if (!ctx.hasUI) {
				return { error: `Todo ${display_todo_id(id)} lock is stale; rerun in interactive mode to steal it.` };
			}
			const ok = await ctx.ui.confirm("Todo locked", `Todo ${display_todo_id(id)} appears locked. Steal the lock?`);
			if (!ok) {
				return { error: `Todo ${display_todo_id(id)} remains locked.` };
			}
			await fs.unlink(lock_path).catch(() => undefined);
		}
	}

	return { error: `Failed to acquire lock for todo ${display_todo_id(id)}.` };
}

export async function with_todo_lock<T>(
	todos_dir: string,
	id: string,
	ctx: ExtensionContext,
	fn: () => Promise<T>,
): Promise<T | { error: string }> {
	const lock = await acquire_lock(todos_dir, id, ctx);
	if (typeof lock === "object" && "error" in lock) return lock;
	try {
		return await fn();
	} finally {
		await lock();
	}
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function list_todos(todos_dir: string): Promise<TodoFrontMatter[]> {
	let entries: string[] = [];
	try {
		entries = await fs.readdir(todos_dir);
	} catch {
		return [];
	}

	const todos: TodoFrontMatter[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const filename_fallback = entry.slice(0, -3);
		const file_path = path.join(todos_dir, entry);
		try {
			const content = await fs.readFile(file_path, "utf8");
			const { front_matter } = split_front_matter(content);
			const parsed = parse_frontmatter(front_matter, filename_fallback);
			todos.push({
				id: parsed.id,
				title: parsed.title,
				tags: parsed.tags ?? [],
				status: parsed.status,
				created_at: parsed.created_at,
				assigned_to_session: parsed.assigned_to_session,
			});
		} catch {
			// ignore unreadable todo
		}
	}

	return sort_todos(todos);
}

export function list_todos_sync(todos_dir: string): TodoFrontMatter[] {
	let entries: string[] = [];
	try {
		entries = readdirSync(todos_dir);
	} catch {
		return [];
	}

	const todos: TodoFrontMatter[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const filename_fallback = entry.slice(0, -3);
		const file_path = path.join(todos_dir, entry);
		try {
			const content = readFileSync(file_path, "utf8");
			const { front_matter } = split_front_matter(content);
			const parsed = parse_frontmatter(front_matter, filename_fallback);
			todos.push({
				id: parsed.id,
				title: parsed.title,
				tags: parsed.tags ?? [],
				status: parsed.status,
				created_at: parsed.created_at,
				assigned_to_session: parsed.assigned_to_session,
			});
		} catch {
			// ignore
		}
	}

	return sort_todos(todos);
}

// ---------------------------------------------------------------------------
// High-level mutations
// ---------------------------------------------------------------------------

export async function update_todo_status(
	todos_dir: string,
	id: string,
	status: string,
	ctx: ExtensionContext,
): Promise<TodoRecord | { error: string }> {
	const validated = validate_todo_id(id);
	if ("error" in validated) return { error: validated.error };
	const normalized_id = validated.id;
	const file_path = await find_todo_path_by_id(todos_dir, normalized_id);
	if (!file_path) {
		return { error: `Todo ${display_todo_id(id)} not found` };
	}

	const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
		const existing = await ensure_todo_exists(file_path, normalized_id);
		if (!existing) return { error: `Todo ${display_todo_id(id)} not found` } as const;
		existing.status = status;
		clear_assignment_if_closed(existing);
		await write_todo_file(file_path, existing);
		return existing;
	});

	return result;
}

export async function claim_todo_assignment(
	todos_dir: string,
	id: string,
	ctx: ExtensionContext,
	force = false,
): Promise<TodoRecord | { error: string }> {
	const validated = validate_todo_id(id);
	if ("error" in validated) return { error: validated.error };
	const normalized_id = validated.id;
	const file_path = await find_todo_path_by_id(todos_dir, normalized_id);
	if (!file_path) {
		return { error: `Todo ${display_todo_id(id)} not found` };
	}
	const session_id = ctx.sessionManager.getSessionId();
	const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
		const existing = await ensure_todo_exists(file_path, normalized_id);
		if (!existing) return { error: `Todo ${display_todo_id(id)} not found` } as const;
		if (is_todo_closed(existing.status)) {
			return { error: `Todo ${display_todo_id(id)} is closed` } as const;
		}
		const assigned = existing.assigned_to_session;
		if (assigned && assigned !== session_id && !force) {
			return {
				error: `Todo ${display_todo_id(id)} is already assigned to session ${assigned}. Use force to override.`,
			} as const;
		}
		if (assigned !== session_id) {
			existing.assigned_to_session = session_id;
			await write_todo_file(file_path, existing);
		}
		return existing;
	});

	return result;
}

export async function release_todo_assignment(
	todos_dir: string,
	id: string,
	ctx: ExtensionContext,
	force = false,
): Promise<TodoRecord | { error: string }> {
	const validated = validate_todo_id(id);
	if ("error" in validated) return { error: validated.error };
	const normalized_id = validated.id;
	const file_path = await find_todo_path_by_id(todos_dir, normalized_id);
	if (!file_path) {
		return { error: `Todo ${display_todo_id(id)} not found` };
	}
	const session_id = ctx.sessionManager.getSessionId();
	const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
		const existing = await ensure_todo_exists(file_path, normalized_id);
		if (!existing) return { error: `Todo ${display_todo_id(id)} not found` } as const;
		const assigned = existing.assigned_to_session;
		if (!assigned) return existing;
		if (assigned !== session_id && !force) {
			return {
				error: `Todo ${display_todo_id(id)} is assigned to session ${assigned}. Use force to release.`,
			} as const;
		}
		existing.assigned_to_session = undefined;
		await write_todo_file(file_path, existing);
		return existing;
	});

	return result;
}

export async function delete_todo(
	todos_dir: string,
	id: string,
	ctx: ExtensionContext,
): Promise<TodoRecord | { error: string }> {
	const validated = validate_todo_id(id);
	if ("error" in validated) return { error: validated.error };
	const normalized_id = validated.id;
	const file_path = await find_todo_path_by_id(todos_dir, normalized_id);
	if (!file_path) {
		return { error: `Todo ${display_todo_id(id)} not found` };
	}

	const result = await with_todo_lock(todos_dir, normalized_id, ctx, async () => {
		const existing = await ensure_todo_exists(file_path, normalized_id);
		if (!existing) return { error: `Todo ${display_todo_id(id)} not found` } as const;
		await fs.unlink(file_path);
		return existing;
	});

	return result;
}
