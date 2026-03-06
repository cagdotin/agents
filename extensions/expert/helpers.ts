import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { DOMAIN_NAME_PATTERN } from "./constants.js";
import type { ExpertiseHeader } from "./types.js";

// ---------------------------------------------------------------------------
// Domain name validation
// ---------------------------------------------------------------------------

export function validate_domain_name(domain: string): { valid: true } | { valid: false; error: string } {
	if (!domain) {
		return { valid: false, error: "Domain name is required" };
	}
	if (!DOMAIN_NAME_PATTERN.test(domain)) {
		return {
			valid: false,
			error: "Domain name must be lowercase alphanumeric with hyphens (e.g. 'database', 'auth-flow')",
		};
	}
	return { valid: true };
}

// ---------------------------------------------------------------------------
// Domain matching — score a user prompt against domains
// ---------------------------------------------------------------------------

export interface DomainMatch {
	domain: ExpertiseHeader;
	score: number;
}

const MIN_DOMAIN_MATCH_SCORE = 6;
const glob_pattern_cache = new Map<string, RegExp | null>();

export function match_domains_to_prompt(prompt: string, domains: ExpertiseHeader[]): DomainMatch[] {
	const lower_prompt = prompt.toLowerCase();
	const prompt_words = new Set(split_prompt_words(lower_prompt));

	const matches: DomainMatch[] = [];

	for (const domain of domains) {
		let score = 0;

		if (lower_prompt.includes(domain.domain.toLowerCase())) {
			score += 10;
		}

		const alias_values = new Set((domain.aliases ?? []).map((value) => value.toLowerCase().trim()).filter(Boolean));
		for (const alias of alias_values) {
			if (term_matches_prompt(alias, lower_prompt, prompt_words)) {
				score += 8;
			}
		}

		const keyword_values = new Set((domain.keywords ?? []).map((value) => value.toLowerCase().trim()).filter(Boolean));
		for (const keyword of keyword_values) {
			if (term_matches_prompt(keyword, lower_prompt, prompt_words)) {
				score += 4;
			}
		}

		const description_words = new Set(split_prompt_words(domain.description.toLowerCase()));
		for (const description_word of description_words) {
			if (prompt_words.has(description_word)) {
				score += 2;
			}
		}

		for (const scope_path of domain.scope.paths) {
			const normalized_scope_path = normalize_path_for_match(scope_path).replace(/\/$/, "").toLowerCase();
			if (normalized_scope_path && lower_prompt.includes(normalized_scope_path)) {
				score += 8;
			}
		}

		for (const scope_pattern of domain.scope.patterns ?? []) {
			const normalized_pattern = normalize_path_for_match(scope_pattern).toLowerCase();
			if (!normalized_pattern) continue;

			if (lower_prompt.includes(normalized_pattern)) {
				score += 6;
				continue;
			}

			const basename_hint = extract_pattern_basename_hint(normalized_pattern);
			if (basename_hint && term_matches_prompt(basename_hint, lower_prompt, prompt_words)) {
				score += 6;
			}
		}

		if (score >= MIN_DOMAIN_MATCH_SCORE) {
			matches.push({ domain, score });
		}
	}

	return matches.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// File-to-domain matching — map modified file paths to domains
// ---------------------------------------------------------------------------

export function match_files_to_domains(
	file_paths: string[],
	domains: ExpertiseHeader[],
	cwd: string,
): ExpertiseHeader[] {
	const matched = new Set<string>();

	for (const file_path of file_paths) {
		const relative = path.relative(cwd, path.resolve(cwd, file_path));
		const normalized_relative = normalize_path_for_match(relative);

		for (const domain of domains) {
			if (matched.has(domain.domain)) continue;

			let domain_matched = false;

			for (const scope_path of domain.scope.paths) {
				const normalized_scope = normalize_path_for_match(scope_path).replace(/\/$/, "");
				if (!normalized_scope) continue;

				if (normalized_relative.startsWith(`${normalized_scope}/`) || normalized_relative === normalized_scope) {
					domain_matched = true;
					break;
				}
			}

			if (!domain_matched) {
				for (const scope_pattern of domain.scope.patterns ?? []) {
					if (glob_matches_path(scope_pattern, normalized_relative)) {
						domain_matched = true;
						break;
					}
				}
			}

			if (domain_matched) {
				matched.add(domain.domain);
			}
		}
	}

	return domains.filter((d) => matched.has(d.domain));
}

function split_prompt_words(text: string): string[] {
	return text.split(/[\s,.:;!?()[\]{}"'`/\\]+/).filter((word) => word.length > 2);
}

function term_matches_prompt(term: string, lower_prompt: string, prompt_words: Set<string>): boolean {
	const normalized_term = term.trim().toLowerCase();
	if (normalized_term.length < 3) return false;

	if (!normalized_term.includes(" ")) {
		return prompt_words.has(normalized_term) || lower_prompt.includes(normalized_term);
	}

	return lower_prompt.includes(normalized_term);
}

function extract_pattern_basename_hint(pattern: string): string | null {
	const segments = pattern.split("/").map((segment) => segment.trim());
	for (let i = segments.length - 1; i >= 0; i--) {
		const segment = segments[i];
		if (!segment) continue;
		if (segment.includes("*") || segment.includes("?")) continue;
		const hint = segment.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
		if (hint.length >= 3) {
			return hint;
		}
	}
	return null;
}

function glob_matches_path(pattern: string, target_path: string): boolean {
	const normalized_pattern = normalize_path_for_match(pattern);
	if (!normalized_pattern) return false;

	const compiled_pattern = compile_glob_pattern(normalized_pattern);
	if (!compiled_pattern) return false;

	return compiled_pattern.test(normalize_path_for_match(target_path));
}

function compile_glob_pattern(pattern: string): RegExp | null {
	if (glob_pattern_cache.has(pattern)) {
		return glob_pattern_cache.get(pattern) ?? null;
	}

	let regex_text = "^";

	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i];

		if (ch === "*") {
			if (pattern[i + 1] === "*") {
				if (pattern[i + 2] === "/") {
					regex_text += "(?:.*/)?";
					i += 2;
					continue;
				}
				regex_text += ".*";
				i += 1;
				continue;
			}

			regex_text += "[^/]*";
			continue;
		}

		if (ch === "?") {
			regex_text += "[^/]";
			continue;
		}

		regex_text += escape_regex_character(ch);
	}

	regex_text += "$";

	try {
		const compiled = new RegExp(regex_text);
		glob_pattern_cache.set(pattern, compiled);
		return compiled;
	} catch {
		glob_pattern_cache.set(pattern, null);
		console.debug(`[expert] Ignoring invalid scope pattern: ${pattern}`);
		return null;
	}
}

function escape_regex_character(value: string): string {
	return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function normalize_path_for_match(value: string): string {
	return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

// ---------------------------------------------------------------------------
// Extract modified file paths from agent messages
// ---------------------------------------------------------------------------

export function extract_modified_files(messages: any[]): string[] {
	const files = new Set<string>();

	for (const msg of messages) {
		if (!msg || typeof msg !== "object") continue;

		// Look at tool results for write/edit operations
		if (msg.role === "toolResult") {
			const tool_name = msg.toolName;
			if (tool_name === "write" || tool_name === "edit") {
				const path_value = msg.input?.path ?? msg.details?.path;
				if (typeof path_value === "string") {
					files.add(path_value);
				}
			}
		}

		// Also check tool calls in assistant messages
		if (msg.role === "assistant" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_use") {
					const name = block.name;
					if ((name === "write" || name === "edit") && block.input?.path) {
						files.add(block.input.path);
					}
				}
			}
		}
	}

	return [...files];
}

// ---------------------------------------------------------------------------
// Format conversation for reflection prompt (domain-filtered)
// ---------------------------------------------------------------------------

export function format_conversation_for_reflection(
	messages: any[],
	scope_paths?: string[],
	scope_patterns?: string[],
): string {
	const lines: string[] = [];

	for (const msg of messages) {
		if (!msg || typeof msg !== "object") continue;

		if (msg.role === "user") {
			const content = extract_text_content(msg.content);
			if (content) {
				lines.push(`## User\n${content}\n`);
			}
		} else if (msg.role === "assistant") {
			const content = extract_text_content(msg.content);
			if (content) {
				lines.push(`## Assistant\n${content}\n`);
			}
		} else if (msg.role === "toolResult") {
			// When scope_paths is provided, filter tool results to only include
			// files within the domain's scope
			if ((scope_paths && scope_paths.length > 0) || (scope_patterns && scope_patterns.length > 0)) {
				const file_path = extract_tool_file_path(msg);
				if (file_path && !file_matches_scope(file_path, scope_paths ?? [], scope_patterns)) {
					continue; // skip tool results outside this domain's scope
				}
			}

			const tool_name = msg.toolName ?? "unknown";
			const content = extract_text_content(msg.content);
			if (content) {
				// Truncate long tool results
				const truncated = content.length > 2000 ? `${content.slice(0, 2000)}\n... (truncated)` : content;
				lines.push(`## Tool Result (${tool_name})\n${truncated}\n`);
			}
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Format conversation for router — compact view, no tool output
// ---------------------------------------------------------------------------

export function format_conversation_for_router(messages: any[]): string {
	const lines: string[] = [];

	for (const msg of messages) {
		if (!msg || typeof msg !== "object") continue;

		if (msg.role === "user") {
			const content = extract_text_content(msg.content);
			if (content) {
				lines.push(`## User\n${content}\n`);
			}
		} else if (msg.role === "assistant") {
			// Summarize assistant reasoning — first 3 + last 2 lines if long
			const text = extract_text_content(msg.content);
			if (text) {
				const summarized = summarize_text(text, 3, 2);
				lines.push(`## Assistant\n${summarized}\n`);
			}

			// Extract tool calls as one-liners
			const tool_calls = extract_tool_call_summaries(msg.content);
			if (tool_calls.length > 0) {
				lines.push(`## Tool Calls\n${tool_calls.join("\n")}\n`);
			}
		}
		// toolResult messages are completely skipped for the router
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Check if a file path falls within any scope path or scope pattern
// ---------------------------------------------------------------------------

export function file_matches_scope(file_path: string, scope_paths: string[], scope_patterns?: string[]): boolean {
	const normalized_file = normalize_path_for_match(file_path);

	for (const scope of scope_paths) {
		const normalized_scope = normalize_path_for_match(scope).replace(/\/$/, "");
		if (!normalized_scope) continue;

		if (normalized_file.startsWith(`${normalized_scope}/`) || normalized_file === normalized_scope) {
			return true;
		}
	}

	for (const scope_pattern of scope_patterns ?? []) {
		if (glob_matches_path(scope_pattern, normalized_file)) {
			return true;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// Extract file path from a tool result message
// ---------------------------------------------------------------------------

function extract_tool_file_path(msg: any): string | null {
	// Try input.path first (most common for write/edit/read)
	const path_from_input = msg.input?.path ?? msg.details?.path;
	if (typeof path_from_input === "string") return path_from_input;
	return null;
}

// ---------------------------------------------------------------------------
// Summarize long text blocks — keep first N + last M lines
// ---------------------------------------------------------------------------

function summarize_text(text: string, first_n: number, last_m: number): string {
	const text_lines = text.split("\n");
	if (text_lines.length <= first_n + last_m + 2) return text;

	const head = text_lines.slice(0, first_n);
	const tail = text_lines.slice(-last_m);
	const omitted = text_lines.length - first_n - last_m;
	return [...head, `... (${omitted} lines omitted)`, ...tail].join("\n");
}

// ---------------------------------------------------------------------------
// Extract tool calls from assistant content as one-liner summaries
// ---------------------------------------------------------------------------

function extract_tool_call_summaries(content: unknown): string[] {
	if (!Array.isArray(content)) return [];

	const summaries: string[] = [];
	for (const block of content) {
		if (block?.type !== "tool_use") continue;

		const name = block.name ?? "unknown";
		const input = block.input ?? {};

		if (name === "write" || name === "edit" || name === "read") {
			summaries.push(`- ${name} ${input.path ?? "?"}`);
		} else if (name === "bash") {
			const cmd = typeof input.command === "string" ? input.command.split("\n")[0].slice(0, 80) : "?";
			summaries.push(`- bash: ${cmd}`);
		} else {
			// Generic tool call — show name + first key
			const first_key = Object.keys(input)[0];
			const hint = first_key ? ` ${first_key}=${JSON.stringify(input[first_key]).slice(0, 40)}` : "";
			summaries.push(`- ${name}${hint}`);
		}
	}
	return summaries;
}

function extract_text_content(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((block: any) => block?.type === "text" && typeof block.text === "string")
			.map((block: any) => block.text)
			.join("\n");
	}
	return "";
}

// ---------------------------------------------------------------------------
// Scan scope paths — list files under scope directories
// ---------------------------------------------------------------------------

export async function scan_scope_paths(scope_paths: string[], cwd: string, max_depth: number = 4): Promise<string[]> {
	const result: string[] = [];

	for (const scope_path of scope_paths) {
		const absolute = path.resolve(cwd, scope_path);
		if (!existsSync(absolute)) continue;

		const stat = await fs.stat(absolute);
		if (stat.isFile()) {
			result.push(path.relative(cwd, absolute));
			continue;
		}

		if (stat.isDirectory()) {
			await walk_directory(absolute, cwd, 0, max_depth, result);
		}
	}

	return result.sort();
}

async function walk_directory(
	dir: string,
	cwd: string,
	depth: number,
	max_depth: number,
	result: string[],
): Promise<void> {
	if (depth >= max_depth) return;

	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		// Skip common non-essential directories
		if (entry.isDirectory() && is_ignored_dir(entry.name)) continue;

		const full_path = path.join(dir, entry.name);

		if (entry.isFile()) {
			result.push(path.relative(cwd, full_path));
		} else if (entry.isDirectory()) {
			await walk_directory(full_path, cwd, depth + 1, max_depth, result);
		}
	}
}

function is_ignored_dir(name: string): boolean {
	const ignored = new Set([
		"node_modules",
		".git",
		".next",
		".nuxt",
		"dist",
		"build",
		"out",
		".cache",
		"coverage",
		"__pycache__",
		".venv",
		"venv",
		".tox",
		"target",
	]);
	return ignored.has(name);
}
