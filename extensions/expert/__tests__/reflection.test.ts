import { describe, expect, it } from "vitest";
import { parse_reflection_output } from "../reflection.js";

// ---------------------------------------------------------------------------
// parse_reflection_output
// ---------------------------------------------------------------------------

describe("parse_reflection_output", () => {
	it("parses both XML tags present", () => {
		const output = `Some preamble text.

<updated_expertise>
domain: test-domain
description: "Updated description"
</updated_expertise>

<reflection_summary>
- Added new gotcha about X
- Removed stale pattern Y
</reflection_summary>`;

		const result = parse_reflection_output(output);
		expect(result).not.toBeNull();
		expect(result!.updated_yaml).toContain("domain: test-domain");
		expect(result!.updated_yaml).toContain('description: "Updated description"');
		expect(result!.summary).toContain("Added new gotcha about X");
	});

	it("returns null when updated_expertise tag missing", () => {
		const output = `<reflection_summary>
- Some summary
</reflection_summary>`;

		expect(parse_reflection_output(output)).toBeNull();
	});

	it("returns fallback summary when reflection_summary tag missing", () => {
		const output = `<updated_expertise>
domain: test
description: "Test"
</updated_expertise>`;

		const result = parse_reflection_output(output);
		expect(result).not.toBeNull();
		expect(result!.summary).toBe("Expertise updated (no summary provided)");
	});

	it("handles extra whitespace in tags", () => {
		const output = `<updated_expertise>
  domain: test
  description: "Test"
</updated_expertise>

<reflection_summary>
  - Updated things
</reflection_summary>`;

		const result = parse_reflection_output(output);
		expect(result).not.toBeNull();
		expect(result!.updated_yaml).toContain("domain: test");
		expect(result!.summary).toContain("Updated things");
	});

	it("updated_yaml ends with newline", () => {
		const output = `<updated_expertise>
domain: test
</updated_expertise>`;

		const result = parse_reflection_output(output);
		expect(result).not.toBeNull();
		expect(result!.updated_yaml.endsWith("\n")).toBe(true);
	});

	it("returns null for empty string", () => {
		expect(parse_reflection_output("")).toBeNull();
	});

	it("returns null for malformed XML", () => {
		expect(parse_reflection_output("<updated_expertise>content without closing tag")).toBeNull();
	});
});
