import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { z } from "zod";
import { TRACK_STATUSES, TRACK_TOOL_ACTIONS, TRACK_TRACE_ACTIONS } from "./constants.js";

export type TrackStatus = (typeof TRACK_STATUSES)[number];
export type TrackToolAction = (typeof TRACK_TOOL_ACTIONS)[number];
export type TrackTraceAction = (typeof TRACK_TRACE_ACTIONS)[number];

export interface TrackMetadata {
	name: string;
	purpose: string;
	status: TrackStatus;
	created_at: string;
	updated_at: string;
	last_synced_at: string;
	related_paths: string[];
	session_count?: number;
	closed_at?: string;
	summary_version?: number;
}

export interface TrackSettings {
	active_track?: string;
}

export interface TrackRecord {
	slug: string;
	dir: string;
	metadata: TrackMetadata;
	missing_files: string[];
	is_active: boolean;
}

export interface TrackContextMessageDetails {
	track: string;
	purpose: string;
	status: TrackStatus;
}

export interface TrackTraceEntry {
	action: TrackTraceAction;
	track?: string;
	status?: TrackStatus;
	timestamp: string;
}

export const TrackParams = Type.Object({
	action: StringEnum(TRACK_TOOL_ACTIONS),
	name: Type.Optional(Type.String({ description: "Track name or slug" })),
	purpose: Type.Optional(Type.String({ description: "Short statement of what this track is for" })),
	related_paths: Type.Optional(
		Type.Array(Type.String({ description: "Path related to this track" }), {
			description: "Repo paths or references related to the track",
		}),
	),
	activate: Type.Optional(Type.Boolean({ description: "Mark the track active after creation" })),
});

export type TrackToolDetails =
	| { action: "list"; tracks: TrackRecord[]; active_track?: string; error?: string }
	| { action: "get" | "create" | "set-active" | "status" | "sync" | "end"; track?: TrackRecord; error?: string };

export const track_metadata_schema = z.object({
	name: z.string().min(1, "name is required"),
	purpose: z.string().min(1, "purpose is required"),
	status: z.enum(TRACK_STATUSES),
	created_at: z.string().min(1, "created_at is required"),
	updated_at: z.string().min(1, "updated_at is required"),
	last_synced_at: z.string().min(1, "last_synced_at is required"),
	related_paths: z.array(z.string()),
	session_count: z.number().int().nonnegative().optional(),
	closed_at: z.string().min(1).optional(),
	summary_version: z.number().int().positive().optional(),
});

export const track_settings_schema = z.object({
	active_track: z.string().min(1).optional(),
});

export const track_trace_entry_schema = z.object({
	action: z.enum(TRACK_TRACE_ACTIONS),
	track: z.string().min(1).optional(),
	status: z.enum(TRACK_STATUSES).optional(),
	timestamp: z.string().min(1),
});
