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
	related_domains?: string[];
}

export interface ExpertiseRecord extends ExpertiseHeader {
	/** The full raw YAML content of the file */
	raw: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ExpertiseSettings {
	max_context_percent_for_any_inject: number;
}

// ---------------------------------------------------------------------------
// Injection notification details
// ---------------------------------------------------------------------------

export interface ExpertiseInjectionDetails {
	domains: Array<{
		domain: string;
		description: string;
		pinned?: boolean;
		related_domains?: string[];
	}>;
}

export interface ExpertiseSkipDetails {
	reason: string;
	usage_percent: number;
	threshold_percent: number;
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
	action: StringEnum(["list", "get", "init", "update", "append", "delete"] as const),
	domain: Type.Optional(
		Type.String({ description: "Domain name (lowercase, hyphens allowed, e.g. 'database', 'auth-flow')" }),
	),
	description: Type.Optional(Type.String({ description: "Human-readable description of what this domain covers" })),
	scope_paths: Type.Optional(
		Type.Array(Type.String(), { description: "File paths/directories this domain covers (for init)" }),
	),
	content: Type.Optional(Type.String({ description: "Full YAML content for the expertise file (for update)" })),
	section: Type.Optional(
		Type.String({
			description: "Target section for append (e.g. 'gotchas', 'design_decisions', 'patterns', 'references')",
		}),
	),
});

export type ExpertiseAction = "list" | "get" | "init" | "update" | "append" | "delete";

// ---------------------------------------------------------------------------
// Tool result details
// ---------------------------------------------------------------------------

export type ExpertiseToolDetails =
	| { action: "list"; domains: ExpertiseHeader[]; error?: string }
	| { action: "get"; domain: string; expertise: ExpertiseRecord; error?: string }
	| { action: "init"; domain: string; expertise: ExpertiseRecord; file_listing: string; error?: string }
	| { action: "update"; domain: string; error?: string }
	| { action: "append"; domain: string; section: string; error?: string }
	| { action: "delete"; domain: string; error?: string };
