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

/** Detail data extracted from tool call arguments in assistant messages. */
export interface ToolDetails {
	/** bash: CLI program name → invocation count */
	bash_programs: Map<string, number>;
	/** Read: unique file paths seen */
	read_files: string[];
	/** Edit: unique file paths seen */
	edit_files: string[];
	/** Write: unique file paths seen */
	write_files: string[];
	/** expertise: action → domain list */
	expertise_actions: Map<string, string[]>;
	/** todo: action → count */
	todo_actions: Map<string, number>;
	/** Chronological read events interleaved with user-message markers. */
	read_timeline_events: FileTimelineEvent[];
	/** Chronological edit events interleaved with user-message markers. */
	edit_timeline_events: FileTimelineEvent[];
	/** Chronological write events interleaved with user-message markers. */
	write_timeline_events: FileTimelineEvent[];
}

/** File category for read files. */
export type FileCategory = "docs" | "skills" | "tests" | "code";

/** A single event in a file-operation timeline — either a user-message boundary or a file op. */
export type FileTimelineEvent =
	| {
			kind: "user-marker";
			timestamp: string;
			user_message_index: number;
	  }
	| {
			kind: "file-op";
			timestamp: string;
			op_order: number;
			path: string;
			category: FileCategory;
			user_message_index: number;
			is_repeat: boolean;
	  };

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
	/** Extracted argument details per tool */
	tool_details: ToolDetails;
	/** Total available tools in session (from pi.getAllTools()) */
	available_tool_count: number;
	/** Names of all available tools */
	available_tool_names: string[];
}
