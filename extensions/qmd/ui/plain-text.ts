import type { QmdPanelSnapshot } from "./data.js";
import { format_relative_time } from "./data.js";

export function build_plain_text_summary(snapshot: QmdPanelSnapshot): string {
	const lines: string[] = [];

	if (snapshot.binding_status === "unavailable") {
		lines.push("QMD Index: unavailable");
		if (snapshot.error_reason) {
			lines.push(snapshot.error_reason);
		}
		return lines.join("\n");
	}

	if (snapshot.binding_status === "not_indexed") {
		lines.push("QMD Index: not indexed");
		if (snapshot.repo_root) {
			lines.push(`repo: ${snapshot.repo_root}`);
		}
		lines.push("Run /qmd init to onboard this repository.");
		return lines.join("\n");
	}

	// Indexed
	const freshness_badge =
		snapshot.freshness_status === "fresh"
			? "fresh"
			: snapshot.freshness_status === "stale"
				? `${snapshot.stale_count} stale`
				: "freshness unknown";

	lines.push(`QMD Index: indexed · ${freshness_badge}`);
	lines.push(
		[snapshot.collection_key, snapshot.glob_pattern, `${snapshot.total_documents} docs`].filter(Boolean).join("  ·  "),
	);

	if (snapshot.last_indexed_at) {
		const parts = [`last indexed: ${format_relative_time(snapshot.last_indexed_at)}`];
		if (snapshot.last_indexed_commit) {
			parts.push(snapshot.last_indexed_commit.slice(0, 7));
		}
		lines.push(parts.join("  ·  "));
	}

	lines.push("");
	lines.push(`documents: ${snapshot.total_documents}`);
	lines.push(`vector index: ${snapshot.has_vector_index ? "yes" : "no"}`);
	lines.push(`needs embed: ${snapshot.needs_embedding}`);

	if (snapshot.contexts.length > 0) {
		lines.push("");
		lines.push(`Contexts (${snapshot.contexts.length}):`);
		for (const ctx of snapshot.contexts) {
			lines.push(`  ${ctx.path}  ${ctx.annotation}`);
		}
	}

	if (snapshot.stale_count > 0) {
		lines.push("");
		lines.push(`Stale (${snapshot.stale_count}):`);
		for (const p of snapshot.stale_paths) {
			lines.push(`  ${p}`);
		}
	}

	return lines.join("\n");
}
