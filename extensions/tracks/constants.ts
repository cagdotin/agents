export const TRACKS_DIR_NAME = ".pi/tracks";
export const TRACK_SETTINGS_FILE_NAME = "settings.json";
export const TRACK_METADATA_FILE_NAME = "track.yaml";
export const TRACK_STATUS_KEY = "track";
export const TRACK_TOOL_NAME = "track";
export const TRACK_COMMAND_NAME = "track";
export const TRACK_SUMMARY_VERSION = 1;

export const TRACK_CONTEXT_MESSAGE_TYPE = "track-context-loaded";
export const TRACK_TRACE_ENTRY_TYPE = "track-state";

export const TRACK_CLOSEOUT_START_MARKER = "<!-- track-closeout:start -->";
export const TRACK_CLOSEOUT_END_MARKER = "<!-- track-closeout:end -->";

export const TRACK_STATUSES = ["active", "paused", "closed"] as const;
export const TRACK_TOOL_ACTIONS = ["list", "get", "create", "set-active", "status", "sync", "end"] as const;
export const TRACK_TRACE_ACTIONS = ["set-active", "clear-active", "end"] as const;

export const TRACK_TEMPLATE_FILE_NAMES = [
	"AGENTS.md",
	"summary.md",
	"tasks.md",
	"references.md",
	"findings.md",
	"decisions.md",
	"report.md",
] as const;

export const TRACK_REQUIRED_FILE_NAMES = [...TRACK_TEMPLATE_FILE_NAMES, TRACK_METADATA_FILE_NAME] as const;

export const TRACK_DIRECTORY_NAMES = ["notes", "artifacts"] as const;

export const TRACK_REGENERATABLE_TEMPLATE_FILE_NAMES = TRACK_TEMPLATE_FILE_NAMES.filter(
	(file_name) => file_name !== "summary.md",
);
