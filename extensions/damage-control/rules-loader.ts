import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import YAML from "yaml";
import { z } from "zod";
import { DAMAGE_CONTROL_PROJECT_DIR_NAME, DAMAGE_CONTROL_RULES_FILE_NAME } from "./constants.js";
import type {
	ActiveRules,
	CompiledBashPatternRule,
	PathRule,
	RuleAction,
	RuleSource,
	RulesLoadResult,
} from "./types.js";

const RULE_FILE_KEYS = new Set([
	"version",
	"bash_tool_patterns",
	"zero_access_paths",
	"read_only_paths",
	"no_delete_paths",
]);

const raw_rules_file_schema = z
	.object({
		version: z.unknown().optional(),
		bash_tool_patterns: z.unknown().optional(),
		zero_access_paths: z.unknown().optional(),
		read_only_paths: z.unknown().optional(),
		no_delete_paths: z.unknown().optional(),
	})
	.passthrough();

const raw_bash_pattern_rule_schema = z
	.object({
		id: z.string().trim().min(1).optional(),
		pattern: z.string().optional(),
		reason: z.string().optional(),
		action: z.enum(["block", "ask"]).optional(),
	})
	.passthrough();

export async function load_rules(cwd: string, import_meta_url: string): Promise<RulesLoadResult> {
	const bundled_source: RuleSource = {
		kind: "bundled",
		path: get_bundled_rules_path(import_meta_url),
	};
	const global_source: RuleSource = {
		kind: "global",
		path: path.join(getAgentDir(), DAMAGE_CONTROL_RULES_FILE_NAME),
	};

	const discovered_project_path = find_project_rules_path(cwd);
	const project_source: RuleSource | undefined = discovered_project_path
		? {
				kind: "project",
				path: discovered_project_path,
			}
		: undefined;

	const sources: RuleSource[] = [bundled_source, global_source, ...(project_source ? [project_source] : [])];

	const warnings: string[] = [];
	const skipped_sources: Array<{ source: RuleSource; reason: string }> = [];
	const loaded_sources: RuleSource[] = [];
	let invalid_rule_count = 0;

	const bash_tool_patterns: CompiledBashPatternRule[] = [];
	const zero_access_paths: PathRule[] = [];
	const read_only_paths: PathRule[] = [];
	const no_delete_paths: PathRule[] = [];

	for (const source of sources) {
		const source_result = await parse_rules_source(source);
		if (source_result.error) {
			skipped_sources.push({ source, reason: source_result.error });
			warnings.push(`${source.kind} rules skipped: ${source_result.error}`);
			continue;
		}

		loaded_sources.push(source);
		warnings.push(...source_result.warnings);
		invalid_rule_count += source_result.invalid_rule_count;

		append_unique_bash_rules(bash_tool_patterns, source_result.bash_tool_patterns);
		append_unique_path_rules(zero_access_paths, source_result.zero_access_paths);
		append_unique_path_rules(read_only_paths, source_result.read_only_paths);
		append_unique_path_rules(no_delete_paths, source_result.no_delete_paths);
	}

	const rules: ActiveRules = {
		bash_tool_patterns,
		zero_access_paths,
		read_only_paths,
		no_delete_paths,
		warnings,
	};

	return {
		rules,
		stats: {
			loaded_sources,
			skipped_sources,
			invalid_rule_count,
		},
	};
}

interface ParseSourceResult {
	bash_tool_patterns: CompiledBashPatternRule[];
	zero_access_paths: PathRule[];
	read_only_paths: PathRule[];
	no_delete_paths: PathRule[];
	warnings: string[];
	invalid_rule_count: number;
	error?: string;
}

async function parse_rules_source(source: RuleSource): Promise<ParseSourceResult> {
	const empty: ParseSourceResult = {
		bash_tool_patterns: [],
		zero_access_paths: [],
		read_only_paths: [],
		no_delete_paths: [],
		warnings: [],
		invalid_rule_count: 0,
	};

	if (!existsSync(source.path)) {
		return { ...empty, error: "file not found" };
	}

	let raw_text: string;
	try {
		raw_text = await fs.readFile(source.path, "utf8");
	} catch (error: any) {
		return { ...empty, error: `read failed: ${error?.message ?? "unknown error"}` };
	}

	let parsed_raw: unknown;
	try {
		parsed_raw = YAML.parse(raw_text);
	} catch (error: any) {
		return { ...empty, error: `yaml parse failed: ${error?.message ?? "unknown error"}` };
	}

	const parsed_result = raw_rules_file_schema.safeParse(parsed_raw ?? {});
	if (!parsed_result.success) {
		return { ...empty, error: "yaml root is not an object" };
	}
	const parsed = parsed_result.data;

	const warnings: string[] = [];
	let invalid_rule_count = 0;

	for (const key of Object.keys(parsed)) {
		if (!RULE_FILE_KEYS.has(key)) {
			warnings.push(`${source.kind}: ignoring unknown key '${key}' in ${source.path}`);
		}
	}

	const bash_tool_patterns: CompiledBashPatternRule[] = [];
	const raw_bash_rules = parsed.bash_tool_patterns;
	if (raw_bash_rules !== undefined && !Array.isArray(raw_bash_rules)) {
		invalid_rule_count += 1;
		warnings.push(`${source.kind}: 'bash_tool_patterns' must be an array`);
	}
	for (const raw_rule of Array.isArray(raw_bash_rules) ? raw_bash_rules : []) {
		const normalized_rule = normalize_bash_rule(raw_rule, source);
		if (!normalized_rule.valid || !normalized_rule.rule) {
			invalid_rule_count += 1;
			warnings.push(`${source.kind}: invalid bash_tool_patterns entry ignored (${normalized_rule.reason})`);
			continue;
		}
		bash_tool_patterns.push(normalized_rule.rule);
	}

	const zero_access_paths = normalize_path_rules(parsed.zero_access_paths, "zero_access_paths", source);
	const read_only_paths = normalize_path_rules(parsed.read_only_paths, "read_only_paths", source);
	const no_delete_paths = normalize_path_rules(parsed.no_delete_paths, "no_delete_paths", source);

	invalid_rule_count +=
		zero_access_paths.invalid_rule_count + read_only_paths.invalid_rule_count + no_delete_paths.invalid_rule_count;
	warnings.push(...zero_access_paths.warnings, ...read_only_paths.warnings, ...no_delete_paths.warnings);

	return {
		bash_tool_patterns,
		zero_access_paths: zero_access_paths.rules,
		read_only_paths: read_only_paths.rules,
		no_delete_paths: no_delete_paths.rules,
		warnings,
		invalid_rule_count,
	};
}

function normalize_bash_rule(
	raw_rule: unknown,
	source: RuleSource,
): { valid: boolean; reason?: string; rule?: CompiledBashPatternRule } {
	const parsed_rule = raw_bash_pattern_rule_schema.safeParse(raw_rule);
	if (!parsed_rule.success) {
		return { valid: false, reason: format_zod_issues(parsed_rule.error) };
	}

	const normalized_rule = parsed_rule.data;
	const pattern = normalized_rule.pattern?.trim() ?? "";
	const reason = normalized_rule.reason?.trim() ?? "";
	if (!pattern) return { valid: false, reason: "missing pattern" };
	if (!reason) return { valid: false, reason: "missing reason" };

	const action: RuleAction = normalized_rule.action === "ask" ? "ask" : "block";
	const id = normalized_rule.id?.trim() || undefined;

	let regex: RegExp;
	try {
		regex = new RegExp(pattern);
	} catch (error: any) {
		return { valid: false, reason: `invalid regex (${error?.message ?? "unknown error"})` };
	}

	const signature = id ? `id:${id}` : `pattern:${pattern}|reason:${reason}|action:${action}`;
	return {
		valid: true,
		rule: {
			id,
			pattern,
			reason,
			action,
			regex,
			source,
			signature,
		},
	};
}

function normalize_path_rules(
	values: unknown,
	field_name: string,
	source: RuleSource,
): { rules: PathRule[]; warnings: string[]; invalid_rule_count: number } {
	if (values === undefined) {
		return { rules: [], warnings: [], invalid_rule_count: 0 };
	}

	if (!Array.isArray(values)) {
		return {
			rules: [],
			warnings: [`${source.kind}: '${field_name}' must be an array`],
			invalid_rule_count: 1,
		};
	}

	const rules: PathRule[] = [];
	const warnings: string[] = [];
	let invalid_rule_count = 0;

	for (const value of values) {
		if (typeof value !== "string") {
			invalid_rule_count += 1;
			warnings.push(`${source.kind}: non-string value ignored in '${field_name}'`);
			continue;
		}
		const pattern = value.trim();
		if (!pattern) {
			invalid_rule_count += 1;
			warnings.push(`${source.kind}: empty string ignored in '${field_name}'`);
			continue;
		}

		rules.push({
			pattern,
			source,
			signature: pattern,
		});
	}

	return { rules, warnings, invalid_rule_count };
}

function format_zod_issues(error: z.ZodError): string {
	const issue_messages = error.issues.map((issue) => {
		const field_path = issue.path.length > 0 ? issue.path.join(".") : "entry";
		return `${field_path}: ${issue.message}`;
	});
	return issue_messages.join("; ");
}

function append_unique_bash_rules(target: CompiledBashPatternRule[], incoming: CompiledBashPatternRule[]): void {
	const seen = new Set(target.map((rule) => rule.signature));
	for (const rule of incoming) {
		if (seen.has(rule.signature)) continue;
		target.push(rule);
		seen.add(rule.signature);
	}
}

function append_unique_path_rules(target: PathRule[], incoming: PathRule[]): void {
	const seen = new Set(target.map((rule) => rule.signature));
	for (const rule of incoming) {
		if (seen.has(rule.signature)) continue;
		target.push(rule);
		seen.add(rule.signature);
	}
}

function get_bundled_rules_path(import_meta_url: string): string {
	const file_path = fileURLToPath(import_meta_url);
	return path.join(path.dirname(file_path), DAMAGE_CONTROL_RULES_FILE_NAME);
}

function find_project_rules_path(cwd: string): string | undefined {
	const start_dir = path.resolve(cwd);
	const git_root = find_git_root(start_dir);
	const fs_root = path.parse(start_dir).root;

	let current = start_dir;
	while (true) {
		const candidate = path.join(current, DAMAGE_CONTROL_PROJECT_DIR_NAME, DAMAGE_CONTROL_RULES_FILE_NAME);
		if (existsSync(candidate)) {
			return candidate;
		}

		if (git_root && current === git_root) break;
		if (!git_root && current === fs_root) break;

		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return undefined;
}

function find_git_root(start_dir: string): string | undefined {
	let current = start_dir;
	const fs_root = path.parse(start_dir).root;

	while (true) {
		const git_path = path.join(current, ".git");
		if (existsSync(git_path)) {
			return current;
		}
		if (current === fs_root) break;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return undefined;
}
