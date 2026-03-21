export type RuleAction = "block" | "ask";

export type RuleSourceKind = "bundled" | "global" | "project";

export interface RuleSource {
	kind: RuleSourceKind;
	path: string;
}

export interface RawBashPatternRule {
	id?: string;
	pattern?: string;
	reason?: string;
	action?: RuleAction;
}

export interface RawRulesFile {
	version?: number;
	bash_tool_patterns?: RawBashPatternRule[];
	zero_access_paths?: string[];
	read_only_paths?: string[];
	no_delete_paths?: string[];
}

export interface CompiledBashPatternRule {
	id?: string;
	pattern: string;
	reason: string;
	action: RuleAction;
	regex: RegExp;
	source: RuleSource;
	signature: string;
}

export interface PathRule {
	pattern: string;
	source: RuleSource;
	signature: string;
}

export interface ActiveRules {
	bash_tool_patterns: CompiledBashPatternRule[];
	zero_access_paths: PathRule[];
	read_only_paths: PathRule[];
	no_delete_paths: PathRule[];
	warnings: string[];
}

export interface RulesLoadStats {
	loaded_sources: RuleSource[];
	skipped_sources: Array<{ source: RuleSource; reason: string }>;
	invalid_rule_count: number;
}

export interface RulesLoadResult {
	rules: ActiveRules;
	stats: RulesLoadStats;
}

export type ViolationType = "bash_pattern" | "zero_access" | "read_only" | "no_delete";

export interface PolicyViolation {
	type: ViolationType;
	action: RuleAction;
	reason: string;
	rule_id?: string;
	rule_pattern: string;
	source: RuleSource;
}

export interface EnforcementResult {
	blocked: boolean;
	violation?: PolicyViolation;
	confirmation_required: boolean;
}

export interface DamageControlLogEntry {
	timestamp: string;
	tool_name: string;
	action: "blocked" | "blocked_by_user" | "confirmed_by_user" | "allowed";
	reason: string;
	rule_type: ViolationType;
	rule_pattern: string;
	rule_id?: string;
	rule_source: RuleSourceKind;
	input_preview: string;
}

export interface DamageControlUiState {
	unread_count: number;
	panel_open: boolean;
	last_opened_at: string | null;
	incident_active: boolean;
	enabled: boolean;
}

export type DamageControlFooterState = "healthy" | "notify" | "incident";

export interface DamageControlPanelRow {
	timestamp: string;
	action: "blocked" | "blocked_by_user" | "confirmed_by_user" | "allowed";
	tool_name: string;
	reason: string;
	rule_type: ViolationType;
	rule_source: RuleSourceKind;
	input_preview: string;
}
