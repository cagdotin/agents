export interface ToolTally {
	calls: number;
	errors: number;
}

export interface ModelUsageEntry {
	model_id: string;
	model_name: string;
	provider: string;
	selected_at: string;
}

export interface SessionStats {
	session_started_at: string | null;
	tool_tallies: Map<string, ToolTally>;
	total_tool_calls: number;
	total_tool_errors: number;
	turn_count: number;
	agent_loop_count: number;
	user_prompt_count: number;
	user_bash_count: number;
	compaction_count: number;
	model_history: ModelUsageEntry[];
	/** CLI programs invoked via the bash tool, keyed by program name */
	bash_programs: Map<string, number>;
	/** Total available tools in the session */
	available_tool_count: number;
	/** Names of all available tools */
	available_tool_names: string[];
}
