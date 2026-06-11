import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Validates module boundary invariants across the repository.
 *
 * Currently enforced:
 *   1. No cross-extension imports (ARCHITECTURE.md Invariant #2)
 *
 * Designed to be extended with additional boundary rules as they emerge
 * (e.g., "extensions must not import from skills/", "skills must not contain .ts files").
 */

type BoundaryViolation = {
	file_path: string;
	line: number;
	message: string;
	hint: string;
};

const IMPORT_PATTERN = /(?:import|export)\s+.*?\s+from\s+["']([^"']+)["']|(?:import|export)\s*\(["']([^"']+)["']\)/gu;

async function main() {
	const repo_root = process.cwd();
	const violations: BoundaryViolation[] = [];

	await check_cross_extension_imports(repo_root, violations);

	if (violations.length === 0) {
		console.log("✅ Module boundary validation passed.");
		return;
	}

	console.error(`❌ Module boundary validation failed with ${violations.length} violation(s):`);
	for (const violation of violations) {
		console.error(`- ${violation.file_path}:${violation.line}: ${violation.message}`);
		console.error(`  hint: ${violation.hint}`);
	}

	process.exitCode = 1;
}

async function check_cross_extension_imports(repo_root: string, violations: BoundaryViolation[]) {
	const extensions_dir = path.join(repo_root, "extensions");
	const entries = await readdir(extensions_dir, { withFileTypes: true });

	const extension_dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

	for (const ext_name of extension_dirs) {
		const ext_dir = path.join(extensions_dir, ext_name);
		const ts_files = await collect_ts_files(ext_dir);

		for (const ts_file of ts_files) {
			await check_file_imports(repo_root, ts_file, ext_name, extension_dirs, violations);
		}
	}
}

async function check_file_imports(
	repo_root: string,
	file_path: string,
	owner_extension: string,
	all_extensions: string[],
	violations: BoundaryViolation[],
) {
	const content = await readFile(file_path, "utf8");
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const line_number = i + 1;

		// Reset regex state for each line
		IMPORT_PATTERN.lastIndex = 0;
		let match = IMPORT_PATTERN.exec(line);

		while (match) {
			const import_specifier = match[1] ?? match[2];
			if (!import_specifier) {
				match = IMPORT_PATTERN.exec(line);
				continue;
			}

			const target_extension = resolve_cross_extension_import(
				file_path,
				import_specifier,
				owner_extension,
				all_extensions,
			);

			if (target_extension) {
				violations.push({
					file_path: path.relative(repo_root, file_path),
					line: line_number,
					message: `extension '${owner_extension}' imports from extension '${target_extension}'`,
					hint:
						`Extensions must not have cross-dependencies (ARCHITECTURE.md Invariant #2). ` +
						`If both extensions need shared logic, extract it to a shared utility module. ` +
						`If '${owner_extension}' needs data from '${target_extension}', consider a hook-based approach ` +
						`or pass the data through the Pi extension API.`,
				});
			}

			match = IMPORT_PATTERN.exec(line);
		}
	}
}

/**
 * Determines if an import specifier crosses an extension boundary.
 * Returns the target extension name if it's a violation, null otherwise.
 */
function resolve_cross_extension_import(
	source_file: string,
	import_specifier: string,
	owner_extension: string,
	all_extensions: string[],
): string | null {
	// Only relative imports can cross extension boundaries
	// (package imports like "@earendil-works/pi-coding-agent" are fine)
	if (!import_specifier.startsWith(".")) {
		return null;
	}

	const source_dir = path.dirname(source_file);
	const resolved = path.resolve(source_dir, import_specifier);

	// Normalize: strip .js/.ts extensions for path matching
	const normalized = resolved.replace(/\.[jt]sx?$/u, "");

	const extensions_root = find_extensions_root(source_file);
	if (!extensions_root) {
		return null;
	}

	for (const ext_name of all_extensions) {
		if (ext_name === owner_extension) {
			continue;
		}

		const target_ext_dir = path.join(extensions_root, ext_name);
		if (normalized.startsWith(target_ext_dir) || `${normalized}/`.startsWith(`${target_ext_dir}/`)) {
			return ext_name;
		}
	}

	return null;
}

function find_extensions_root(file_path: string): string | null {
	const parts = file_path.split(path.sep);
	const extensions_index = parts.lastIndexOf("extensions");
	if (extensions_index === -1) {
		return null;
	}
	return parts.slice(0, extensions_index + 1).join(path.sep);
}

async function collect_ts_files(dir: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const full_path = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = await collect_ts_files(full_path);
			results.push(...nested);
		} else if (entry.isFile() && /\.tsx?$/u.test(entry.name)) {
			results.push(full_path);
		}
	}

	return results;
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`❌ Module boundary validation crashed: ${message}`);
	process.exitCode = 1;
});
