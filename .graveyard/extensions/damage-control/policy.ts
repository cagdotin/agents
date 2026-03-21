import { isToolCallEventType, type ToolCallEvent } from "@mariozechner/pi-coding-agent";
import {
	command_mentions_path_rule,
	is_bash_delete_operation,
	is_bash_mutation_operation,
	path_rule_matches_target,
} from "./matcher.js";
import type { ActiveRules, EnforcementResult, PathRule, PolicyViolation, RuleSource, ViolationType } from "./types.js";

export function evaluate_tool_call(event: ToolCallEvent, cwd: string, rules: ActiveRules): EnforcementResult {
	if (isToolCallEventType("bash", event)) {
		return evaluate_bash_tool_call(event.input.command, rules, cwd);
	}

	const candidate_paths = extract_candidate_paths(event);
	if (candidate_paths.length === 0) {
		return { blocked: false, confirmation_required: false };
	}

	const zero_access_violation = find_path_violation(
		candidate_paths,
		rules.zero_access_paths,
		cwd,
		"zero_access",
		"block",
	);
	if (zero_access_violation) {
		return {
			blocked: true,
			violation: zero_access_violation,
			confirmation_required: false,
		};
	}

	if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
		const read_only_violation = find_path_violation(candidate_paths, rules.read_only_paths, cwd, "read_only", "block");
		if (read_only_violation) {
			return {
				blocked: true,
				violation: read_only_violation,
				confirmation_required: false,
			};
		}
	}

	return {
		blocked: false,
		confirmation_required: false,
	};
}

function evaluate_bash_tool_call(command: string, rules: ActiveRules, cwd: string): EnforcementResult {
	for (const rule of rules.zero_access_paths) {
		if (!command_mentions_path_rule(command, rule, cwd)) continue;
		return {
			blocked: true,
			violation: build_violation(
				"zero_access",
				"block",
				rule.pattern,
				"bash command references zero-access path",
				rule.source,
			),
			confirmation_required: false,
		};
	}

	for (const rule of rules.bash_tool_patterns) {
		if (!rule.regex.test(command)) continue;

		return {
			blocked: rule.action === "block",
			violation: {
				type: "bash_pattern",
				action: rule.action,
				reason: rule.reason,
				rule_id: rule.id,
				rule_pattern: rule.pattern,
				source: rule.source,
			},
			confirmation_required: rule.action === "ask",
		};
	}

	if (is_bash_mutation_operation(command)) {
		for (const rule of rules.read_only_paths) {
			if (!command_mentions_path_rule(command, rule, cwd)) continue;
			return {
				blocked: true,
				violation: build_violation(
					"read_only",
					"block",
					rule.pattern,
					"bash command may mutate read-only path",
					rule.source,
				),
				confirmation_required: false,
			};
		}
	}

	if (is_bash_delete_operation(command)) {
		for (const rule of rules.no_delete_paths) {
			if (!command_mentions_path_rule(command, rule, cwd)) continue;
			return {
				blocked: true,
				violation: build_violation(
					"no_delete",
					"block",
					rule.pattern,
					"bash command may delete protected path",
					rule.source,
				),
				confirmation_required: false,
			};
		}
	}

	return { blocked: false, confirmation_required: false };
}

function extract_candidate_paths(event: ToolCallEvent): string[] {
	if (isToolCallEventType("read", event) || isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
		return [event.input.path];
	}

	if (isToolCallEventType("grep", event)) {
		const values: string[] = [];
		if (event.input.path) values.push(event.input.path);
		if (event.input.glob) values.push(event.input.glob);
		if (values.length === 0) values.push(".");
		return values;
	}

	if (isToolCallEventType("find", event) || isToolCallEventType("ls", event)) {
		return [event.input.path || "."];
	}

	const custom_input = event.input as Record<string, unknown>;
	const values: string[] = [];
	if (typeof custom_input.path === "string") {
		values.push(custom_input.path);
	}
	if (Array.isArray(custom_input.paths)) {
		for (const value of custom_input.paths) {
			if (typeof value === "string") values.push(value);
		}
	}
	return values;
}

function find_path_violation(
	candidate_paths: string[],
	rules: PathRule[],
	cwd: string,
	violation_type: ViolationType,
	action: "block",
): PolicyViolation | undefined {
	for (const candidate_path of candidate_paths) {
		for (const rule of rules) {
			if (!path_rule_matches_target(candidate_path, rule, cwd)) continue;

			const reason =
				violation_type === "zero_access"
					? "access to zero-access path"
					: violation_type === "read_only"
						? "modification of read-only path"
						: "deletion of protected path";
			return build_violation(violation_type, action, rule.pattern, reason, rule.source);
		}
	}
	return undefined;
}

function build_violation(
	type: ViolationType,
	action: "block",
	rule_pattern: string,
	reason: string,
	source: RuleSource,
): PolicyViolation {
	return {
		type,
		action,
		reason: `${reason}: ${rule_pattern}`,
		rule_pattern,
		source,
	};
}
