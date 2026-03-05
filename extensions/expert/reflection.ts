import { REFLECTION_PROMPT } from "./constants.js";
import {
	read_expertise,
	write_expertise,
	append_reflection_log,
	get_expertise_dir,
	list_domains,
} from "./storage.js";
import { format_conversation_for_reflection } from "./helpers.js";
import { run_router } from "./router.js";
import { run_completion } from "./llm.js";
import type { ExpertiseSettings, ReflectionLogEntry, PipelineResult } from "./types.js";

// ---------------------------------------------------------------------------
// Reflection result
// ---------------------------------------------------------------------------

export interface ReflectionResult {
	updated_yaml: string;
	summary: string;
}

// ---------------------------------------------------------------------------
// Parse reflection output
// ---------------------------------------------------------------------------

export function parse_reflection_output(output: string): ReflectionResult | null {
	const yaml_match = output.match(
		/<updated_expertise>\s*\n?([\s\S]*?)\n?\s*<\/updated_expertise>/,
	);
	const summary_match = output.match(
		/<reflection_summary>\s*\n?([\s\S]*?)\n?\s*<\/reflection_summary>/,
	);

	if (!yaml_match) return null;

	return {
		updated_yaml: yaml_match[1].trim() + "\n",
		summary: summary_match ? summary_match[1].trim() : "Expertise updated (no summary provided)",
	};
}

// ---------------------------------------------------------------------------
// Build the reflection input (user message content)
// ---------------------------------------------------------------------------

function build_reflection_input(
	current_expertise_yaml: string,
	conversation: string,
	router_points?: string,
): string {
	const router_section = router_points
		? `\n## Router Attention Signal

The router identified these points as relevant to your domain. Use them as a starting point but still review the full conversation — the router may have missed things.

${router_points}\n`
		: "";

	return `## Current Expertise File

\`\`\`yaml
${current_expertise_yaml}
\`\`\`
${router_section}
## Conversation Transcript

${conversation}`;
}

// ---------------------------------------------------------------------------
// Run reflection for a single domain
// ---------------------------------------------------------------------------

export async function run_reflection(
	domain: string,
	messages: any[],
	cwd: string,
	session_file: string,
	settings: ExpertiseSettings,
	scope_paths?: string[],
	router_points?: string,
): Promise<ReflectionResult | { error: string }> {
	const expertise_dir = get_expertise_dir(cwd);
	const existing = await read_expertise(expertise_dir, domain);

	if (!existing) {
		return { error: `Domain '${domain}' not found` };
	}

	// Format conversation — filtered to domain scope when scope_paths provided
	const conversation = format_conversation_for_reflection(messages, scope_paths);
	if (!conversation.trim()) {
		return { error: "No conversation content to reflect on" };
	}

	// Build the user message content
	const user_text = build_reflection_input(existing.raw, conversation, router_points);

	try {
		const output = await run_completion(
			REFLECTION_PROMPT,
			user_text,
			settings.reflection_model || undefined,
		);
		const parsed = parse_reflection_output(output);

		if (!parsed) {
			return { error: "Failed to parse reflection output — model did not return expected format" };
		}

		// Write the updated expertise
		await write_expertise(expertise_dir, domain, parsed.updated_yaml);

		// Append to reflection log
		const log_entry: ReflectionLogEntry = {
			date: new Date().toISOString(),
			domain,
			session: session_file,
			model: settings.reflection_model || "(default)",
			summary: parsed.summary,
		};
		await append_reflection_log(expertise_dir, log_entry);

		return parsed;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { error: `Reflection failed: ${message}` };
	}
}

// ---------------------------------------------------------------------------
// Reflection pipeline — router → parallel domain experts
// ---------------------------------------------------------------------------

export async function run_reflection_pipeline(
	messages: any[],
	settings: ExpertiseSettings,
	cwd: string,
	session_file: string,
	target_domain?: string,
	on_status?: (message: string) => void,
): Promise<PipelineResult> {
	const expertise_dir = get_expertise_dir(cwd);

	// Single-domain shortcut — skip router, go straight to reflection
	if (target_domain) {
		const existing = await read_expertise(expertise_dir, target_domain);
		if (!existing) {
			return {
				results: [{ domain: target_domain, summary: "", error: `Domain '${target_domain}' not found` }],
				router_skipped: true,
			};
		}

		on_status?.(`🧠 Reflecting on ${target_domain}...`);

		const result = await run_reflection(
			target_domain,
			messages,
			cwd,
			session_file,
			settings,
			existing.scope.paths,
		);

		if ("error" in result) {
			return {
				results: [{ domain: target_domain, summary: "", error: result.error }],
				router_skipped: true,
			};
		}

		return {
			results: [{ domain: target_domain, summary: result.summary }],
			router_skipped: true,
		};
	}

	// Full pipeline — Stage 1: Router
	const domains = await list_domains(expertise_dir);
	if (domains.length === 0) {
		return {
			results: [],
			router_skipped: false,
		};
	}

	on_status?.("🧠 Router: identifying affected domains...");

	const router_result = await run_router(messages, domains, settings);

	if ("error" in router_result) {
		return {
			results: [{ domain: "*", summary: "", error: `Router failed: ${router_result.error}` }],
			router_skipped: false,
		};
	}

	if (router_result.length === 0) {
		return {
			results: [],
			router_skipped: false,
		};
	}

	// Stage 2: Parallel domain expert reflections
	const domain_map = new Map(domains.map((d) => [d.domain, d]));

	const reflection_promises = router_result.map(async (r) => {
		const domain_info = domain_map.get(r.domain);
		if (!domain_info) {
			return { domain: r.domain, summary: "", error: `Domain '${r.domain}' not found` };
		}

		on_status?.(`🧠 Reflecting on ${r.domain}...`);

		const result = await run_reflection(
			r.domain,
			messages,
			cwd,
			session_file,
			settings,
			domain_info.scope.paths,
			r.points,
		);

		if ("error" in result) {
			return { domain: r.domain, summary: "", error: result.error };
		}

		return { domain: r.domain, summary: result.summary };
	});

	const results = await Promise.all(reflection_promises);

	return {
		results,
		router_skipped: false,
	};
}
