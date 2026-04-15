import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { z } from "zod";
import { type FeatureConfig, register_conditional_feature } from "@/lib/extension-runtime/conditional-feature";

const dependencies_schema = z.optional(z.record(z.string(), z.string()));

const package_json_schema = z.looseObject({
	dependencies: dependencies_schema,
	devDependencies: dependencies_schema,
	peerDependencies: dependencies_schema,
	optionalDependencies: dependencies_schema,
});

type PackageJSON = z.infer<typeof package_json_schema>;

const has_package_dependency = (package_name: string, package_json?: PackageJSON) => {
	if (!package_json) return false;

	return [
		package_json.dependencies,
		package_json.devDependencies,
		package_json.peerDependencies,
		package_json.optionalDependencies,
	].some((deps) => deps?.[package_name] !== undefined);
};

const get_package_json = (cwd: string) => {
	const current_dir = path.resolve(cwd);
	const package_json_path = path.join(current_dir, "package.json");
	const exists = existsSync(package_json_path);

	if (!exists) return undefined;

	try {
		const file = readFileSync(package_json_path, "utf8");
		return package_json_schema.parse(JSON.parse(file));
	} catch {
		return undefined;
	}
};

interface Config extends FeatureConfig {
	has_react: boolean;
	has_next_js: boolean;
	has_shadcn: boolean;
}

const detect_dependencies = (cwd: string): Config => {
	const package_json = get_package_json(cwd);
	const has_react = has_package_dependency("react", package_json);
	const has_next_js = has_package_dependency("next", package_json);
	const has_shadcn = has_package_dependency("shadcn", package_json);

	return {
		enabled: has_react || has_next_js,
		has_react,
		has_next_js,
		has_shadcn,
	};
};

const get_skills = (config: Config) => {
	if (!config.enabled) return [];

	const base_path = path.dirname(new URL(import.meta.url).pathname);

	const skills = [
		path.resolve(base_path, "skills", "frontend-design"),
		path.resolve(base_path, "skills", "web-design-guidelines"),
	];

	if (config.has_react) {
		skills.push(path.resolve(base_path, "skills", "vercel-react-best-practices"));
	}

	if (config.has_next_js) {
		skills.push(path.resolve(base_path, "skills", "next-best-practices"));
	}

	if (config.has_shadcn) {
		skills.push(path.resolve(base_path, "skills", "shadcn"));
	}

	return skills;
};

export default function frontend_dev(pi: ExtensionAPI) {
	register_conditional_feature<Config>(pi, {
		init: (ctx) => detect_dependencies(ctx.cwd),
		get_skills,
		activate: (ctx, _config) => {
			ctx.ui.setStatus("frontend-dev", "fe-dev");
		},
	});
}
