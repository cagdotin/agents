import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Static } from "@sinclair/typebox";
import type { TraceInstruction } from "./actions.js";
import { action_create, action_end, action_get, action_list, action_set_active, action_sync } from "./actions.js";
import { get_session_track_slug, serialize_track_for_agent, serialize_track_list_for_agent } from "./helpers.js";
import { get_tracks_dir } from "./storage.js";
import { TrackParams, type TrackToolDetails } from "./types.js";

function build_tool_result(action: string, result: { track?: any; tracks?: any; error?: string }, extra?: object) {
	if (result.error) {
		return {
			content: [{ type: "text", text: result.error }],
			details: { action, error: result.error, ...extra } satisfies TrackToolDetails,
		};
	}

	if (result.tracks) {
		return {
			content: [{ type: "text", text: serialize_track_list_for_agent(result.tracks) }],
			details: { action: "list", tracks: result.tracks, ...extra } satisfies TrackToolDetails,
		};
	}

	return {
		content: [{ type: "text", text: serialize_track_for_agent(result.track!) }],
		details: { action, track: result.track, ...extra } satisfies TrackToolDetails,
	};
}

export function create_track_tool(
	tracks_dir_label: string,
	append_trace: (action: "set-active" | "clear-active" | "end", track?: string) => void,
) {
	function emit_traces(traces: TraceInstruction[]) {
		for (const trace of traces) {
			append_trace(trace.action, trace.track);
		}
	}

	return {
		name: "track",
		label: "Track",
		description:
			`Manage ongoing workstream tracks in ${tracks_dir_label} (list, get, create, set-active, status, sync, end). ` +
			"Tracks are repo-agnostic runtime workspaces with a local AGENTS.md, deterministic summary.md sync, active-track binding, and support for multiple milestones before closeout.",
		parameters: TrackParams,
		promptGuidelines: [
			"Use the track tool when the user wants to create, select, inspect, sync, or close a workstream track under .pi/tracks/.",
			"Do not assume a track should close just because one subtask is done; tracks can span multiple sessions and milestones.",
			"Prefer track sync and track end over editing summary.md or track.yaml directly.",
		],

		async execute(
			_tool_call_id: string,
			params: Static<typeof TrackParams>,
			_signal: AbortSignal | undefined,
			_on_update: any,
			ctx: any,
		): Promise<any> {
			const tracks_dir = get_tracks_dir(ctx.cwd);
			const session_track = get_session_track_slug(ctx.sessionManager.getBranch());
			const action = params.action;

			switch (action) {
				case "list": {
					const result = await action_list(tracks_dir, session_track);
					return build_tool_result("list", result, { active_track: session_track });
				}

				case "get":
				case "status": {
					const result = await action_get(tracks_dir, session_track, params.name);
					return build_tool_result(action, result);
				}

				case "create": {
					const name = params.name ? String(params.name).trim() : "";
					const purpose = params.purpose ? String(params.purpose).trim() : "";
					if (!name) {
						return build_tool_result("create", { error: "Track creation requires a name." });
					}
					if (!purpose) {
						return build_tool_result("create", { error: "Track creation requires a purpose." });
					}

					const result = await action_create(tracks_dir, session_track, {
						name,
						purpose,
						related_paths: Array.isArray(params.related_paths) ? params.related_paths.map(String) : [],
						activate: params.activate,
					});
					emit_traces(result.traces);
					return build_tool_result("create", result);
				}

				case "set-active": {
					const name = params.name ? String(params.name).trim() : "";
					if (!name) {
						return build_tool_result("set-active", { error: "Setting the active track requires a name." });
					}
					const result = await action_set_active(tracks_dir, name);
					emit_traces(result.traces);
					return build_tool_result("set-active", result);
				}

				case "sync": {
					const result = await action_sync(tracks_dir, session_track, params.name);
					return build_tool_result("sync", result);
				}

				case "end": {
					const result = await action_end(tracks_dir, session_track, params.name);
					emit_traces(result.traces);
					return build_tool_result("end", result);
				}
			}
		},

		renderCall(args: any, theme: Theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const name = typeof args.name === "string" ? args.name : "";
			let text = theme.fg("toolTitle", theme.bold("track ")) + theme.fg("muted", action);
			if (name) {
				text += ` ${theme.fg("accent", name)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result: any, { isPartial }: any, theme: Theme) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Processing..."), 0, 0);
			}

			const details = result.details as TrackToolDetails | undefined;
			if (!details) {
				const text = result.content?.[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			if (details.action === "list") {
				return new Text(serialize_track_list_for_agent(details.tracks), 0, 0);
			}

			if (!details.track) {
				const text = result.content?.[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const icon =
				details.action === "create"
					? "✓ "
					: details.action === "set-active"
						? "🧵 "
						: details.action === "end"
							? "■ "
							: "";
			return new Text(`${icon}${serialize_track_for_agent(details.track)}`, 0, 0);
		},
	};
}
