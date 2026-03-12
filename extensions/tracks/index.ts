import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import type { ActionResult, TraceInstruction } from "./actions.js";
import { action_create, action_end, action_get, action_list, action_set_active, action_sync } from "./actions.js";
import { TRACK_COMMAND_NAME, TRACK_CONTEXT_MESSAGE_TYPE, TRACK_TRACE_ENTRY_TYPE } from "./constants.js";
import {
	build_track_argument_completions,
	build_track_context_injection,
	build_track_context_message,
	build_track_trace_entry,
	get_session_track_slug,
	restore_track_status,
	serialize_track_for_agent,
	serialize_track_list_for_agent,
	sync_track_record,
} from "./helpers.js";
import {
	ensure_track_settings_file,
	ensure_tracks_dir,
	get_tracks_dir,
	get_tracks_dir_label,
	list_tracks_sync,
	read_track_file,
	read_track_record,
} from "./storage.js";
import { create_track_tool } from "./tool.js";
import type { TrackRecord } from "./types.js";

function emit_traces(pi: ExtensionAPI, traces: TraceInstruction[]) {
	for (const trace of traces) {
		pi.appendEntry(
			TRACK_TRACE_ENTRY_TYPE,
			build_track_trace_entry(trace.action, trace.track, trace.action === "end" ? "closed" : undefined),
		);
	}
}

function tokenize_command_args(input: string): string[] {
	const tokens: string[] = [];
	const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;

	for (const match of input.matchAll(pattern)) {
		tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
	}

	return tokens;
}

function output_message(
	ctx: { hasUI: boolean; ui: { notify: (message: string, level: string) => void } },
	message: string,
	level = "info",
) {
	if (ctx.hasUI) {
		ctx.ui.notify(message, level);
		return;
	}
	console.log(message);
}

function output_action_error(
	ctx: { hasUI: boolean; ui: { notify: (message: string, level: string) => void } },
	result: ActionResult,
): boolean {
	if (result.error) {
		output_message(ctx, result.error, "warning");
		return true;
	}
	return false;
}

export default function tracks_extension(pi: ExtensionAPI) {
	const tracks_dir_label = get_tracks_dir_label();

	pi.on("session_start", async (_event, ctx) => {
		const tracks_dir = get_tracks_dir(ctx.cwd);
		await ensure_tracks_dir(tracks_dir);
		await ensure_track_settings_file(tracks_dir);
		await restore_track_status(ctx);
	});

	for (const event_name of ["session_switch", "session_tree", "session_fork", "session_compact"] as const) {
		pi.on(event_name, async (_event, ctx) => {
			await restore_track_status(ctx);
		});
	}

	pi.on("before_agent_start", async (event, ctx) => {
		const tracks_dir = get_tracks_dir(ctx.cwd);
		const active_track = get_session_track_slug(ctx.sessionManager.getBranch());
		if (!active_track) {
			return;
		}

		let track_record: TrackRecord;
		try {
			track_record = await read_track_record(tracks_dir, active_track);
		} catch (error: any) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(message, "warning");
			return;
		}

		let agents_md = "";
		let summary_md = "";
		try {
			[agents_md, summary_md] = await Promise.all([
				read_track_file(track_record.dir, "AGENTS.md"),
				read_track_file(track_record.dir, "summary.md"),
			]);
		} catch {
			try {
				const synced = await sync_track_record(tracks_dir, track_record.slug);
				track_record = synced;
				[agents_md, summary_md] = await Promise.all([
					read_track_file(track_record.dir, "AGENTS.md"),
					read_track_file(track_record.dir, "summary.md"),
				]);
			} catch (fallback_error: any) {
				const message = fallback_error instanceof Error ? fallback_error.message : String(fallback_error);
				ctx.ui.notify(`Track '${active_track}' context could not be loaded after sync: ${message}`, "warning");
				return;
			}
		}

		return {
			systemPrompt: event.systemPrompt + build_track_context_injection(track_record, agents_md, summary_md),
			message: build_track_context_message(track_record),
		};
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		const tracks_dir = get_tracks_dir(ctx.cwd);
		const active_track = get_session_track_slug(ctx.sessionManager.getBranch());
		if (!active_track) {
			return;
		}

		try {
			await sync_track_record(tracks_dir, active_track);
		} catch (error: any) {
			const message = error instanceof Error ? error.message : String(error);
			if (ctx.hasUI) {
				ctx.ui.notify(`Track shutdown sync failed: ${message}`, "warning");
			} else {
				console.error(`Track shutdown sync failed: ${message}`);
			}
		}
	});

	pi.registerTool(
		create_track_tool(tracks_dir_label, (action, track) => {
			emit_traces(pi, [{ action, track }]);
		}),
	);

	pi.registerMessageRenderer(TRACK_CONTEXT_MESSAGE_TYPE, (message, _options, theme) => {
		const details = message.details as { track?: string; purpose?: string; status?: string } | undefined;
		if (!details?.track) {
			return undefined;
		}
		const text =
			theme.fg("customMessageLabel", "🧵 track") +
			" " +
			theme.fg("accent", details.track) +
			(details.purpose ? theme.fg("dim", ` · ${details.purpose}`) : "");
		const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(text, 0, 0));
		return box;
	});

	pi.registerCommand(TRACK_COMMAND_NAME, {
		description: "Manage ongoing workstream tracks under .pi/tracks",

		getArgumentCompletions: (prefix: string) => {
			const tracks = list_tracks_sync(get_tracks_dir(process.cwd()));
			return build_track_argument_completions(prefix, tracks, tokenize_command_args);
		},

		handler: async (args, ctx) => {
			const tracks_dir = get_tracks_dir(ctx.cwd);
			const session_track = get_session_track_slug(ctx.sessionManager.getBranch());
			const trimmed = (args ?? "").trim();
			const tokens = tokenize_command_args(trimmed);
			const sub_command = tokens[0] ?? "list";

			try {
				if (!trimmed || sub_command === "list") {
					const result = await action_list(tracks_dir, session_track);
					output_message(ctx, serialize_track_list_for_agent(result.tracks!), "info");
					return;
				}

				if (sub_command === "new") {
					const name = tokens[1];
					if (!name) {
						output_message(ctx, 'Usage: /track new <name> --purpose "..."', "warning");
						return;
					}

					let purpose: string | undefined;
					let activate = false;
					for (let index = 2; index < tokens.length; index += 1) {
						const token = tokens[index];
						if (token === "--purpose") {
							purpose = tokens[index + 1];
							index += 1;
							continue;
						}
						if (token === "--activate") {
							activate = true;
							continue;
						}
						output_message(
							ctx,
							`Unknown option '${token}'. Usage: /track new <name> --purpose "..." [--activate]`,
							"warning",
						);
						return;
					}

					if (!purpose?.trim()) {
						output_message(ctx, 'Track creation requires --purpose "...".', "warning");
						return;
					}

					const result = await action_create(tracks_dir, session_track, { name, purpose, activate });
					if (output_action_error(ctx, result)) return;
					emit_traces(pi, result.traces);
					await restore_track_status(ctx);
					output_message(
						ctx,
						`${serialize_track_for_agent(result.track!)}\n\nTrack created at ${path.relative(ctx.cwd, result.track!.dir)}` +
							(activate ? "\nThis track is now active." : "\nUse /track use <name> to attach a session to it."),
						"info",
					);
					return;
				}

				if (sub_command === "use") {
					const name = tokens[1];
					if (!name) {
						output_message(ctx, "Usage: /track use <name>", "warning");
						return;
					}
					const result = await action_set_active(tracks_dir, name);
					if (output_action_error(ctx, result)) return;
					emit_traces(pi, result.traces);
					await restore_track_status(ctx);
					output_message(ctx, `Active track set to ${result.track!.slug}.`, "info");
					return;
				}

				if (sub_command === "status") {
					const result = await action_get(tracks_dir, session_track, tokens[1]);
					if (output_action_error(ctx, result)) return;
					output_message(ctx, serialize_track_for_agent(result.track!), "info");
					return;
				}

				if (sub_command === "sync") {
					const result = await action_sync(tracks_dir, session_track, tokens[1]);
					if (output_action_error(ctx, result)) return;
					output_message(ctx, `Synced track ${result.track!.slug}.`, "info");
					return;
				}

				if (sub_command === "end") {
					const result = await action_end(tracks_dir, session_track, tokens[1]);
					if (output_action_error(ctx, result)) return;
					emit_traces(pi, result.traces);
					await restore_track_status(ctx);
					output_message(ctx, `Closed track ${result.track!.slug}.`, "info");
					return;
				}

				output_message(
					ctx,
					'Usage: /track [list | new <name> --purpose "..." [--activate] | use <name> | status [name] | sync [name] | end [name]]',
					"info",
				);
			} catch (error: any) {
				const message = error instanceof Error ? error.message : String(error);
				output_message(ctx, message, "error");
			}
		},
	});
}
