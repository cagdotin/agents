import { describe, expect, it } from "vitest";
import { build_router_input, parse_router_output } from "../router.js";
import type { ExpertiseHeader } from "../types.js";

// ---------------------------------------------------------------------------
// parse_router_output
// ---------------------------------------------------------------------------

describe("parse_router_output", () => {
	it("parses multiple domains", () => {
		const output = `<affected_domains>
  <domain name="database">
    <points>
      - Added connection pooling configuration
      - Changed migration strategy
    </points>
  </domain>
  <domain name="auth-flow">
    <points>
      - Updated JWT expiry logic
    </points>
  </domain>
</affected_domains>`;

		const result = parse_router_output(output);
		expect(result.length).toBe(2);
		expect(result[0].domain).toBe("database");
		expect(result[0].points).toContain("connection pooling");
		expect(result[1].domain).toBe("auth-flow");
	});

	it("returns empty array for self-closing tag", () => {
		expect(parse_router_output("<affected_domains />")).toEqual([]);
		expect(parse_router_output("<affected_domains/>")).toEqual([]);
	});

	it("returns empty array for no affected_domains tag", () => {
		expect(parse_router_output("Some random text")).toEqual([]);
	});

	it("returns empty array for empty container", () => {
		expect(parse_router_output("<affected_domains></affected_domains>")).toEqual([]);
	});

	it("handles preamble text before XML", () => {
		const output = `I analyzed the conversation and found:

<affected_domains>
  <domain name="testing">
    <points>
      - Added vitest configuration
    </points>
  </domain>
</affected_domains>

That's my analysis.`;

		const result = parse_router_output(output);
		expect(result.length).toBe(1);
		expect(result[0].domain).toBe("testing");
	});

	it("skips domains with empty points", () => {
		const output = `<affected_domains>
  <domain name="empty-domain">
    <points>
    </points>
  </domain>
</affected_domains>`;

		const result = parse_router_output(output);
		expect(result.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// build_router_input
// ---------------------------------------------------------------------------

describe("build_router_input", () => {
	it("includes domain names and descriptions", () => {
		const domains: ExpertiseHeader[] = [
			{
				domain: "database",
				description: "Database layer",
				last_synced: "2026-01-01",
				scope: { paths: ["src/db/"] },
			},
		];
		const result = build_router_input(domains, "test conversation");
		expect(result).toContain("**database**");
		expect(result).toContain("Database layer");
		expect(result).toContain("src/db/");
		expect(result).toContain("test conversation");
	});

	it("includes multiple domains", () => {
		const domains: ExpertiseHeader[] = [
			{ domain: "auth", description: "Auth", last_synced: "", scope: { paths: ["src/auth/"] } },
			{ domain: "api", description: "API", last_synced: "", scope: { paths: ["src/api/"] } },
		];
		const result = build_router_input(domains, "");
		expect(result).toContain("**auth**");
		expect(result).toContain("**api**");
	});
});
