import { readFileSync } from "node:fs";
import path from "node:path";
import type { TemplateVariables, WorkspaceConfig } from "../constants.js";
import { build_template_vars, generate_skills } from "../skills.js";

describe("build_template_vars", () => {
	test("derives team and team_lower from config", () => {
		const config: WorkspaceConfig = {
			work_roots: ["/resolved/path"],
			linear: { team: "MIND" },
		};
		const vars = build_template_vars(config);
		expect(vars).toEqual({ team: "MIND", team_lower: "mind" });
	});

	test("lowercases mixed-case team names", () => {
		const config: WorkspaceConfig = {
			work_roots: ["/resolved/path"],
			linear: { team: "MyTeam" },
		};
		const vars = build_template_vars(config);
		expect(vars.team).toBe("MyTeam");
		expect(vars.team_lower).toBe("myteam");
	});

	test("throws on empty team string", () => {
		const config: WorkspaceConfig = {
			work_roots: ["/resolved/path"],
			linear: { team: "" },
		};
		expect(() => build_template_vars(config)).toThrow();
	});
});

describe("generate_skills", () => {
	test("renders templates and writes to out directory", () => {
		const vars: TemplateVariables = { team: "ACME", team_lower: "acme" };
		const paths = generate_skills(vars);

		expect(paths).toHaveLength(1);
		expect(paths[0]).toContain("linear");

		const content = readFileSync(path.join(paths[0], "SKILL.md"), "utf8");
		expect(content).toContain("ACME");
		expect(content).toContain("acme");
		expect(content).not.toContain("{{team}}");
		expect(content).not.toContain("{{team_lower}}");
	});

	test("replaces all occurrences of each variable", () => {
		const vars: TemplateVariables = { team: "TEST", team_lower: "test" };
		const paths = generate_skills(vars);

		const content = readFileSync(path.join(paths[0], "SKILL.md"), "utf8");
		// The template has multiple {{team}} references
		const team_occurrences = content.match(/TEST/g);
		expect(team_occurrences).not.toBeNull();
		expect(team_occurrences!.length).toBeGreaterThan(1);
	});

	test("preserves skill markdown structure", () => {
		const vars: TemplateVariables = { team: "ACME", team_lower: "acme" };
		const paths = generate_skills(vars);

		const content = readFileSync(path.join(paths[0], "SKILL.md"), "utf8");
		// Frontmatter
		expect(content).toMatch(/^---\n/);
		expect(content).toContain("name: linear");
		// Headings
		expect(content).toContain("# Linear Skill");
		expect(content).toContain("## Common Commands");
		expect(content).toContain("## Tips");
	});

	test("is idempotent — repeated calls overwrite cleanly", () => {
		const vars: TemplateVariables = { team: "FIRST", team_lower: "first" };
		generate_skills(vars);

		const vars2: TemplateVariables = { team: "SECOND", team_lower: "second" };
		const paths = generate_skills(vars2);

		const content = readFileSync(path.join(paths[0], "SKILL.md"), "utf8");
		expect(content).toContain("SECOND");
		expect(content).not.toContain("FIRST");
	});
});
