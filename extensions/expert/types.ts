import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Expertise record — parsed from YAML
// ---------------------------------------------------------------------------

export interface ExpertiseHeader {
	domain: string;
	description: string;
	last_synced: string;
	scope: {
		paths: string[];
		patterns?: string[];
	};
}

export interface ExpertiseRecord extends ExpertiseHeader {
	/** The full raw YAML content of the file */
	raw: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ExpertiseSettings {
	auto_inject: boolean;
	auto_improve: boolean;
	reflection_model: string;
	max_inject_domains: number;
}

// ---------------------------------------------------------------------------
// Reflection log entry
// ---------------------------------------------------------------------------

export interface ReflectionLogEntry {
	date: string;
	domain: string;
	session: string;
	model: string;
	summary: string;
}

// ---------------------------------------------------------------------------
// Tool parameters
// ---------------------------------------------------------------------------

export const ExpertiseParams = Type.Object({
	action: StringEnum([
		"list",
		"get",
		"init",
		"update",
		"reflect",
		"delete",
	] as const),
	domain: Type.Optional(
		Type.String({ description: "Domain name (lowercase, hyphens allowed, e.g. 'database', 'auth-flow')" }),
	),
	description: Type.Optional(
		Type.String({ description: "Human-readable description of what this domain covers" }),
	),
	scope_paths: Type.Optional(
		Type.Array(Type.String(), { description: "File paths/directories this domain covers (for init)" }),
	),
	content: Type.Optional(
		Type.String({ description: "Full YAML content for the expertise file (for update)" }),
	),
});

export type ExpertiseAction = "list" | "get" | "init" | "update" | "reflect" | "delete";

// ---------------------------------------------------------------------------
// Tool result details
// ---------------------------------------------------------------------------

export type ExpertiseToolDetails =
	| { action: "list"; domains: ExpertiseHeader[]; error?: string }
	| { action: "get"; domain: string; expertise: ExpertiseRecord; error?: string }
	| { action: "init"; domain: string; expertise: ExpertiseRecord; file_listing: string; error?: string }
	| { action: "update"; domain: string; error?: string }
	| { action: "reflect"; domain: string; summary: string; error?: string }
	| { action: "delete"; domain: string; error?: string };
