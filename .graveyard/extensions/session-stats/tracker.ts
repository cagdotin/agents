import { isAbsolute, relative } from "node:path";
import type {
	FileCategory,
	FileTimelineEvent,
	ModelUsageEntry,
	SessionStats,
	ToolDetails,
	ToolTally,
} from "./types.js";

export function create_stats(): SessionStats {
	return {
		session_started_at: null,
		tool_tallies: new Map(),
		total_tool_calls: 0,
		total_tool_errors: 0,
		turn_count: 0,
		agent_loop_count: 0,
		user_prompt_count: 0,
		user_bash_count: 0,
		compaction_count: 0,
		model_history: [],
		tool_details: create_tool_details(),
		available_tool_count: 0,
		available_tool_names: [],
	};
}

function create_tool_details(): ToolDetails {
	return {
		bash_programs: new Map(),
		read_files: [],
		edit_files: [],
		write_files: [],
		expertise_actions: new Map(),
		todo_actions: new Map(),
		read_timeline_events: [],
		edit_timeline_events: [],
		write_timeline_events: [],
	};
}

/**
 * Reconstruct session stats from session entries.
 *
 * Walks the current branch of session entries and counts:
 * - tool results (from message entries with role "toolResult")
 * - turns (from assistant message entries)
 * - user prompts (from user message entries)
 * - user bash commands (from bashExecution message entries)
 * - model changes (from model_change entries)
 * - compactions (from compaction entries)
 *
 * Agent loops are estimated: each user message followed by assistant activity
 * counts as one loop.
 */
export function reconstruct_stats(
	branch_entries: Array<{ type: string; timestamp: string; [key: string]: unknown }>,
	current_model?: { id: string; name: string; provider: string } | undefined,
): SessionStats {
	const stats = create_stats();

	// Session start time = first entry timestamp
	if (branch_entries.length > 0) {
		stats.session_started_at = branch_entries[0].timestamp;
	}

	let last_was_user = false;
	let current_user_message_index = 0;

	// Per-tool timeline tracking state
	const read_timeline = create_timeline_tracker(stats.tool_details.read_timeline_events);
	const edit_timeline = create_timeline_tracker(stats.tool_details.edit_timeline_events);
	const write_timeline = create_timeline_tracker(stats.tool_details.write_timeline_events);

	for (const entry of branch_entries) {
		if (entry.type === "message") {
			const message = (entry as { message: { role: string; [key: string]: unknown } }).message;
			if (!message) continue;

			switch (message.role) {
				case "toolResult": {
					const tool_msg = message as { toolName: string; isError: boolean };
					record_tool_result(stats, tool_msg.toolName, tool_msg.isError);
					break;
				}
				case "assistant": {
					stats.turn_count += 1;
					if (last_was_user) {
						stats.agent_loop_count += 1;
						last_was_user = false;
					}

					// Extract tool call arguments from assistant content
					const content = message.content as
						| Array<{ type: string; name?: string; arguments?: Record<string, unknown> }>
						| undefined;
					if (Array.isArray(content)) {
						for (const block of content) {
							if (block.type === "toolCall" && block.name && block.arguments) {
								extract_tool_call_detail(stats.tool_details, block.name, block.arguments as Record<string, string>);

								const name_lower = block.name.toLowerCase();
								const path = (block.arguments as Record<string, string>).path;

								if (name_lower === "read" && typeof path === "string") {
									emit_file_timeline_event(read_timeline, path, entry.timestamp, current_user_message_index);
								} else if (name_lower === "edit" && typeof path === "string") {
									emit_file_timeline_event(edit_timeline, path, entry.timestamp, current_user_message_index);
								} else if (name_lower === "write" && typeof path === "string") {
									emit_file_timeline_event(write_timeline, path, entry.timestamp, current_user_message_index);
								}
							}
						}
					}
					break;
				}
				case "user": {
					stats.user_prompt_count += 1;
					last_was_user = true;
					current_user_message_index += 1;
					const user_marker = {
						kind: "user-marker" as const,
						timestamp: entry.timestamp,
						user_message_index: current_user_message_index,
					};
					read_timeline.events.push(user_marker);
					edit_timeline.events.push({ ...user_marker });
					write_timeline.events.push({ ...user_marker });
					break;
				}
				case "bashExecution": {
					stats.user_bash_count += 1;
					break;
				}
			}
		} else if (entry.type === "model_change") {
			const model_entry = entry as { modelId: string; provider: string };
			record_model_select(stats, model_entry.modelId, model_entry.modelId, model_entry.provider);
		} else if (entry.type === "compaction") {
			stats.compaction_count += 1;
		}
	}

	// Seed current model if no model_change entries were found
	if (stats.model_history.length === 0 && current_model) {
		record_model_select(stats, current_model.id, current_model.name, current_model.provider);
	}

	// If model_change entries exist but lack a human-friendly name,
	// try to fix the current model's name from ctx.model
	if (current_model && stats.model_history.length > 0) {
		const last = stats.model_history[stats.model_history.length - 1];
		if (last.model_id === current_model.id && last.model_name === last.model_id) {
			last.model_name = current_model.name;
		}
	}

	return stats;
}

export function record_tool_result(stats: SessionStats, tool_name: string, is_error: boolean): void {
	let tally = stats.tool_tallies.get(tool_name);
	if (!tally) {
		tally = { calls: 0, errors: 0 };
		stats.tool_tallies.set(tool_name, tally);
	}
	tally.calls += 1;
	stats.total_tool_calls += 1;
	if (is_error) {
		tally.errors += 1;
		stats.total_tool_errors += 1;
	}
}

export function record_model_select(stats: SessionStats, model_id: string, model_name: string, provider: string): void {
	stats.model_history.push({
		model_id,
		model_name,
		provider,
		selected_at: new Date().toISOString(),
	});
}

export function get_session_duration_ms(stats: SessionStats): number | null {
	if (!stats.session_started_at) return null;
	const start = new Date(stats.session_started_at).getTime();
	if (Number.isNaN(start)) return null;
	return Date.now() - start;
}

export function get_session_duration_label(stats: SessionStats): string {
	const ms = get_session_duration_ms(stats);
	if (ms === null) return "—";
	return format_duration_ms(ms);
}

export function format_duration_ms(ms: number): string {
	const total_seconds = Math.floor(ms / 1000);
	const hours = Math.floor(total_seconds / 3600);
	const minutes = Math.floor((total_seconds % 3600) / 60);
	const seconds = total_seconds % 60;

	if (hours > 0) {
		return `${hours}h ${pad2(minutes)}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${pad2(seconds)}s`;
	}
	return `${seconds}s`;
}

function pad2(n: number): string {
	return `${n}`.padStart(2, "0");
}

export function get_sorted_tool_tallies(stats: SessionStats): Array<[string, ToolTally]> {
	const entries = Array.from(stats.tool_tallies.entries());
	entries.sort((a, b) => b[1].calls - a[1].calls);
	return entries;
}

export function get_current_model(stats: SessionStats): ModelUsageEntry | null {
	if (stats.model_history.length === 0) return null;
	return stats.model_history[stats.model_history.length - 1];
}

export function get_unique_models_used(stats: SessionStats): ModelUsageEntry[] {
	const seen = new Set<string>();
	const unique: ModelUsageEntry[] = [];
	for (const entry of stats.model_history) {
		if (!seen.has(entry.model_id)) {
			seen.add(entry.model_id);
			unique.push(entry);
		}
	}
	return unique;
}

// ── file timeline helpers ────────────────────────────────────

interface TimelineTracker {
	events: FileTimelineEvent[];
	order_counter: number;
	seen_paths: Set<string>;
}

function create_timeline_tracker(events: FileTimelineEvent[]): TimelineTracker {
	return { events, order_counter: 0, seen_paths: new Set() };
}

function emit_file_timeline_event(
	tracker: TimelineTracker,
	raw_path: string,
	timestamp: string,
	user_message_index: number,
): void {
	const path = to_relative_path(raw_path);
	tracker.order_counter += 1;
	const is_repeat = tracker.seen_paths.has(path);
	tracker.seen_paths.add(path);
	tracker.events.push({
		kind: "file-op",
		timestamp,
		op_order: tracker.order_counter,
		path,
		category: categorize_file(path),
		user_message_index,
		is_repeat,
	});
}

// ── path normalization ───────────────────────────────────────

/**
 * Convert an absolute file path to a path relative to cwd (the project root).
 * If the path is already relative, it is returned unchanged.
 * Falls back to the original path if relativization produces an empty string.
 */
export function to_relative_path(file_path: string): string {
	if (!isAbsolute(file_path)) return file_path;
	return relative(process.cwd(), file_path) || file_path;
}

// ── tool detail extraction ──────────────────────────────────

/**
 * Extract CLI program names from a bash command string.
 *
 * Uses quote-aware splitting (respects single/double quotes) then takes
 * the first non-env-var token of each segment. Validates that extracted
 * tokens look like real CLI program names.
 */
export function extract_bash_programs(command: string): string[] {
	if (!command || !command.trim()) return [];

	const segments = split_command_quote_aware(command);
	const programs: string[] = [];

	for (const segment of segments) {
		const trimmed = segment.trim();
		if (!trimmed) continue;

		// Tokenize the segment (outside quotes) to get the first program token
		const tokens = tokenize_unquoted(trimmed);
		let program: string | null = null;

		for (const token of tokens) {
			// Skip env var prefixes like KEY=val
			if (/^\w+=/.test(token)) continue;
			program = token;
			break;
		}

		if (program) {
			// If it's a path, take the basename
			if (program.includes("/")) {
				const parts = program.split("/");
				program = parts[parts.length - 1];
			}
			if (program && is_valid_program_name(program)) {
				programs.push(program);
			}
		}
	}

	return programs;
}

/**
 * Split a command string on &&, ||, ;, | — but only when outside quotes.
 * Respects both single and double quotes, including backslash escapes.
 */
export function split_command_quote_aware(command: string): string[] {
	const segments: string[] = [];
	let current = "";
	let quote_char: string | null = null;
	let i = 0;

	while (i < command.length) {
		const ch = command[i];

		// Handle backslash escapes inside double quotes
		if (ch === "\\" && quote_char === '"' && i + 1 < command.length) {
			current += ch + command[i + 1];
			i += 2;
			continue;
		}

		// Toggle quote state
		if ((ch === '"' || ch === "'") && !quote_char) {
			quote_char = ch;
			current += ch;
			i++;
			continue;
		}
		if (ch === quote_char) {
			quote_char = null;
			current += ch;
			i++;
			continue;
		}

		// Only split on operators when outside quotes
		if (!quote_char) {
			// Check for && and ||
			if (i + 1 < command.length) {
				const two = command[i] + command[i + 1];
				if (two === "&&" || two === "||") {
					segments.push(current);
					current = "";
					i += 2;
					continue;
				}
			}
			// Check for ; and |
			if (ch === ";" || ch === "|") {
				segments.push(current);
				current = "";
				i++;
				continue;
			}
		}

		current += ch;
		i++;
	}

	if (current) {
		segments.push(current);
	}

	return segments;
}

/**
 * Tokenize a command segment by whitespace, but skip over quoted regions.
 * Returns only the unquoted tokens (strips the quoted arguments entirely).
 */
function tokenize_unquoted(segment: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote_char: string | null = null;
	let in_token = false;

	for (let i = 0; i < segment.length; i++) {
		const ch = segment[i];

		// Handle backslash escapes inside double quotes
		if (ch === "\\" && quote_char === '"' && i + 1 < segment.length) {
			i++; // skip escaped char
			continue;
		}

		// Toggle quote state — skip quoted content entirely
		if ((ch === '"' || ch === "'") && !quote_char) {
			quote_char = ch;
			in_token = true;
			continue;
		}
		if (ch === quote_char) {
			quote_char = null;
			continue;
		}

		// Inside quotes — skip
		if (quote_char) continue;

		// Whitespace outside quotes — end current token
		if (/\s/.test(ch)) {
			if (in_token && current) {
				tokens.push(current);
				current = "";
			}
			in_token = false;
			continue;
		}

		// Regular character outside quotes
		in_token = true;
		current += ch;
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

/** Validate that a token looks like a real CLI program name. */
function is_valid_program_name(name: string): boolean {
	if (!name || name.length === 0) return false;
	// Must start with a letter, digit, underscore, or dot (e.g. .bin scripts)
	// Can contain letters, digits, hyphens, underscores, dots
	// Must NOT contain parens, quotes, backslashes, braces, semicolons, etc.
	return /^[a-zA-Z0-9_.][a-zA-Z0-9_.-]*$/.test(name);
}

/** Categorize a file path as docs/skills/tests/code. */
export function categorize_file(path: string): FileCategory {
	const filename = path.split("/").pop() || "";

	// Skills: starts with skills/ or contains /SKILL.md or is SKILL.md
	if (path.startsWith("skills/") || path.includes("/SKILL.md") || filename === "SKILL.md") {
		return "skills";
	}

	// Tests: contains __tests__/ or ends with .test.ts/.spec.ts/.test.js/.spec.js
	if (path.includes("__tests__/") || /\.(test|spec)\.(ts|js)$/.test(path)) {
		return "tests";
	}

	// Docs: starts with docs/ or doc/, ends with .md, or filename is README* or AGENTS.md
	if (
		path.startsWith("docs/") ||
		path.startsWith("doc/") ||
		path.endsWith(".md") ||
		filename.startsWith("README") ||
		filename === "AGENTS.md"
	) {
		return "docs";
	}

	return "code";
}

/** Group file paths by category, sorted within each group. */
export function group_files_by_category(paths: string[]): Map<FileCategory, string[]> {
	const groups = new Map<FileCategory, string[]>();

	for (const path of paths) {
		const category = categorize_file(path);
		let list = groups.get(category);
		if (!list) {
			list = [];
			groups.set(category, list);
		}
		list.push(path);
	}

	// Sort within each group
	for (const list of groups.values()) {
		list.sort();
	}

	return groups;
}

/** Dispatch tool call arguments into the appropriate detail bucket. */
export function extract_tool_call_detail(details: ToolDetails, tool_name: string, args: Record<string, string>): void {
	const name_lower = tool_name.toLowerCase();

	switch (name_lower) {
		case "bash": {
			const command = args.command;
			if (typeof command === "string") {
				const programs = extract_bash_programs(command);
				for (const prog of programs) {
					details.bash_programs.set(prog, (details.bash_programs.get(prog) || 0) + 1);
				}
			}
			break;
		}
		case "read": {
			const path = typeof args.path === "string" ? to_relative_path(args.path) : undefined;
			if (path && !details.read_files.includes(path)) {
				details.read_files.push(path);
			}
			break;
		}
		case "edit": {
			const path = typeof args.path === "string" ? to_relative_path(args.path) : undefined;
			if (path && !details.edit_files.includes(path)) {
				details.edit_files.push(path);
			}
			break;
		}
		case "write": {
			const path = typeof args.path === "string" ? to_relative_path(args.path) : undefined;
			if (path && !details.write_files.includes(path)) {
				details.write_files.push(path);
			}
			break;
		}
		case "expertise": {
			const action = args.action;
			const domain = args.domain;
			if (typeof action === "string") {
				let domains = details.expertise_actions.get(action);
				if (!domains) {
					domains = [];
					details.expertise_actions.set(action, domains);
				}
				if (typeof domain === "string" && !domains.includes(domain)) {
					domains.push(domain);
				}
			}
			break;
		}
		case "todo": {
			const action = args.action;
			if (typeof action === "string") {
				details.todo_actions.set(action, (details.todo_actions.get(action) || 0) + 1);
			}
			break;
		}
	}
}
