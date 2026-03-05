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
	reflection_model: string;
	max_inject_domains: number;
}

// ---------------------------------------------------------------------------
// Router result — output from the domain-routing stage
// ---------------------------------------------------------------------------

export interface RouterResult {
	domain: string;
	points: string;
}

// ---------------------------------------------------------------------------
// Pipeline result — output from full reflection pipeline
// ---------------------------------------------------------------------------

export interface PipelineResult {
	results: Array<{
		domain: string;
		summary: string;
		error?: string;
	}>;
	router_skipped: boolean;
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
// Injection notification details
// ---------------------------------------------------------------------------

export interface ExpertiseInjectionDetails {
	domains: Array<{
		domain: string;
		description: string;
		pinned?: boolean;
	}>;
}

// ---------------------------------------------------------------------------
// Pinned domains — persisted via appendEntry
// ---------------------------------------------------------------------------

export interface ExpertisePinnedState {
	domains: Array<{
		domain: string;
		description: string;
	}>;
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
	| { action: "reflect"; results: PipelineResult["results"]; router_skipped: boolean; error?: string }
	| { action: "delete"; domain: string; error?: string };
