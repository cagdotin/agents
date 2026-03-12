import fs from "node:fs/promises";
import path from "node:path";
import { DOMAIN_NAME_PATTERN } from "./constants.js";

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
// Scan scope paths — list files under scope directories
// ---------------------------------------------------------------------------

export async function scan_scope_paths(scope_paths: string[], cwd: string, max_depth: number = 4): Promise<string[]> {
	const result: string[] = [];

	for (const scope_path of scope_paths) {
		const absolute = path.resolve(cwd, scope_path);

		let stat: Awaited<ReturnType<typeof fs.stat>>;
		try {
			stat = await fs.stat(absolute);
		} catch {
			continue;
		}

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

const IGNORED_DIRS = new Set([
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

function is_ignored_dir(name: string): boolean {
	return IGNORED_DIRS.has(name);
}

// ---------------------------------------------------------------------------
// Command argument parsing — used by /expert init
// ---------------------------------------------------------------------------

export interface ParsedInitArgs {
	domain: string;
	scope_path: string;
	description?: string;
	error?: string;
}

export function parse_init_args(input: string): ParsedInitArgs {
	const tokens = tokenize_command_args(input);
	if (tokens.length < 3 || tokens[0] !== "init") {
		return {
			domain: "",
			scope_path: "",
			error: 'Usage: /expert init <domain> <scope_path> [--description "..."]',
		};
	}

	const domain = tokens[1] ?? "";
	const scope_path = tokens[2] ?? "";

	let description: string | undefined;
	for (let i = 3; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === "--description") {
			const value = tokens[i + 1];
			if (!value) {
				return {
					domain,
					scope_path,
					error: "Missing value for --description",
				};
			}
			description = value.trim();
			i++;
			continue;
		}

		if (token.startsWith("--")) {
			return {
				domain,
				scope_path,
				error: `Unknown option '${token}'.`,
			};
		}

		return {
			domain,
			scope_path,
			error: 'Unexpected arguments. Usage: /expert init <domain> <scope_path> [--description "..."]',
		};
	}

	return {
		domain,
		scope_path,
		description: description && description.length > 0 ? description : undefined,
	};
}

export function tokenize_command_args(input: string): string[] {
	const tokens: string[] = [];
	const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;

	for (const match of input.matchAll(pattern)) {
		const quoted_double = match[1];
		const quoted_single = match[2];
		const raw = match[3];
		tokens.push(quoted_double ?? quoted_single ?? raw);
	}

	return tokens;
}
