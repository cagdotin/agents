import { clear_active_track_if_matches, end_track_record, mark_session_active, sync_track_record } from "./helpers.js";
import {
	create_track_workspace,
	get_track_dir,
	increment_track_session_count,
	list_tracks,
	read_track_record,
	set_active_track,
} from "./storage.js";
import type { TrackRecord, TrackTraceAction } from "./types.js";

export interface TraceInstruction {
	action: TrackTraceAction;
	track?: string;
}

export interface ActionResult {
	track?: TrackRecord;
	tracks?: TrackRecord[];
	error?: string;
	traces: TraceInstruction[];
}

export async function action_list(tracks_dir: string, session_track: string | undefined): Promise<ActionResult> {
	const tracks = (await list_tracks(tracks_dir)).map((r) => mark_session_active(r, session_track));
	return { tracks, traces: [] };
}

export async function action_get(
	tracks_dir: string,
	session_track: string | undefined,
	name?: string,
): Promise<ActionResult> {
	const requested_name = name?.trim() || session_track;
	if (!requested_name) {
		return { error: "No track is attached to this session.", traces: [] };
	}
	const track = mark_session_active(await read_track_record(tracks_dir, requested_name), session_track);
	return { track, traces: [] };
}

export async function action_create(
	tracks_dir: string,
	session_track: string | undefined,
	params: { name: string; purpose: string; related_paths?: string[]; activate?: boolean },
): Promise<ActionResult> {
	if (!params.name.trim()) {
		return { error: "Track creation requires a name.", traces: [] };
	}
	if (!params.purpose.trim()) {
		return { error: "Track creation requires a purpose.", traces: [] };
	}

	let track = await create_track_workspace({
		tracks_dir,
		name: params.name,
		purpose: params.purpose,
		related_paths: params.related_paths ?? [],
	});
	track = await sync_track_record(tracks_dir, track.slug);

	const traces: TraceInstruction[] = [];

	if (params.activate) {
		await set_active_track(tracks_dir, track.slug);
		await increment_track_session_count(get_track_dir(tracks_dir, track.slug));
		traces.push({ action: "set-active", track: track.slug });
		track = await read_track_record(tracks_dir, track.slug);
	}
	track = mark_session_active(track, params.activate ? track.slug : session_track);

	return { track, traces };
}

export async function action_set_active(tracks_dir: string, name: string): Promise<ActionResult> {
	if (!name.trim()) {
		return { error: "Setting the active track requires a name.", traces: [] };
	}

	const track = await read_track_record(tracks_dir, name);
	if (track.metadata.status === "closed") {
		return { error: `Track '${track.slug}' is closed and cannot be made active.`, traces: [] };
	}

	await set_active_track(tracks_dir, track.slug);
	await increment_track_session_count(track.dir);
	const updated = mark_session_active(await read_track_record(tracks_dir, track.slug), track.slug);
	return { track: updated, traces: [{ action: "set-active", track: track.slug }] };
}

export async function action_sync(
	tracks_dir: string,
	session_track: string | undefined,
	name?: string,
): Promise<ActionResult> {
	const requested_name = name?.trim() || session_track;
	if (!requested_name) {
		return { error: "No track is attached to this session.", traces: [] };
	}
	const track = mark_session_active(await sync_track_record(tracks_dir, requested_name), session_track);
	return { track, traces: [] };
}

export async function action_end(
	tracks_dir: string,
	session_track: string | undefined,
	name?: string,
): Promise<ActionResult> {
	const requested_name = name?.trim() || session_track;
	if (!requested_name) {
		return { error: "No track is attached to this session.", traces: [] };
	}

	const track = await end_track_record(tracks_dir, requested_name);
	const traces: TraceInstruction[] = [{ action: "end", track: track.slug }];

	const cleared = await clear_active_track_if_matches(tracks_dir, track.slug);
	if (cleared) {
		traces.push({ action: "clear-active", track: track.slug });
	}

	const ended = await read_track_record(tracks_dir, track.slug);
	return { track: ended, traces };
}
