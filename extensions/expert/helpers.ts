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

export function match_domains_to_prompt(prompt: string, domains: ExpertiseHeader[]): DomainMatch[] {
	const lower_prompt = prompt.toLowerCase();
	const prompt_words = new Set(lower_prompt.split(/[\s,.:;!?()[\]{}"'`/\\]+/).filter((w) => w.length > 2));

	const matches: DomainMatch[] = [];

	for (const domain of domains) {
		let score = 0;

		// Match against domain name
		if (lower_prompt.includes(domain.domain)) {
			score += 10;
		}

		// Match against description words
		const desc_words = domain.description
			.toLowerCase()
			.split(/[\s,.:;!?()[\]{}"'`/\\]+/)
			.filter((w) => w.length > 2);

		for (const word of desc_words) {
			if (prompt_words.has(word)) {
				score += 2;
			}
		}

		// Match against scope paths — if the prompt mentions files/dirs in scope
		for (const scope_path of domain.scope.paths) {
			const normalized = scope_path.replace(/\/$/, "");
			if (lower_prompt.includes(normalized.toLowerCase())) {
				score += 8;
			}
			// Also check just the last segment (e.g. "db" from "src/db")
			const last_segment = path.basename(normalized).toLowerCase();
			if (last_segment.length > 2 && prompt_words.has(last_segment)) {
				score += 4;
			}
		}

		if (score > 0) {
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

		for (const domain of domains) {
			if (matched.has(domain.domain)) continue;

			for (const scope_path of domain.scope.paths) {
				const normalized_scope = scope_path.replace(/\/$/, "");
				if (relative.startsWith(normalized_scope) || relative === normalized_scope) {
					matched.add(domain.domain);
					break;
				}
			}
		}
	}

	return domains.filter((d) => matched.has(d.domain));
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

export function format_conversation_for_reflection(messages: any[], scope_paths?: string[]): string {
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
			if (scope_paths && scope_paths.length > 0) {
				const file_path = extract_tool_file_path(msg);
				if (file_path && !file_matches_scope(file_path, scope_paths)) {
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
// Check if a file path falls within any of the scope paths
// ---------------------------------------------------------------------------

export function file_matches_scope(file_path: string, scope_paths: string[]): boolean {
	const normalized_file = file_path.replace(/^\.\//, "");

	for (const scope of scope_paths) {
		const normalized_scope = scope.replace(/\/$/, "");
		if (normalized_file.startsWith(`${normalized_scope}/`) || normalized_file === normalized_scope) {
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
