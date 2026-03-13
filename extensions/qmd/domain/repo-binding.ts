import { execFile as exec_file_callback } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CollectionBindingMismatchError, get_error_message } from "../core/errors.js";
import { list_collections } from "../core/qmd-store.js";
import {
	type QmdCollectionRecord,
	type QmdRepoMarker,
	qmd_repo_marker_schema,
	type RepoBindingResult,
} from "../core/types.js";

const exec_file = promisify(exec_file_callback);
const QMD_MARKER_RELATIVE_PATH = path.join(".pi", "qmd.json");

function normalize_path_separators(value: string): string {
	return value.replaceAll(path.sep, "/");
}

async function safe_realpath(value: string): Promise<string> {
	try {
		return await realpath(value);
	} catch {
		return path.resolve(value);
	}
}

function build_repair_warning(message: string): string {
	return `${message} Run /qmd update to refresh the local marker if the store binding is still correct, or /qmd init to create a new v1 binding.`;
}

export async function resolve_repo_root(cwd: string): Promise<string> {
	const normalized_cwd = await safe_realpath(cwd);

	try {
		const { stdout } = await exec_file("git", ["-C", normalized_cwd, "rev-parse", "--show-toplevel"]);
		const repo_root = stdout.trim();
		if (!repo_root) {
			return normalized_cwd;
		}
		return safe_realpath(repo_root);
	} catch {
		return normalized_cwd;
	}
}

function get_marker_path(repo_root: string): string {
	return path.join(repo_root, QMD_MARKER_RELATIVE_PATH);
}

export function collection_key_from_repo_root(repo_root: string): string {
	return `p_${Buffer.from(normalize_path_separators(repo_root)).toString("base64url")}`;
}

export async function read_repo_marker(cwd: string): Promise<QmdRepoMarker | null> {
	const repo_root = await resolve_repo_root(cwd);
	const marker_path = get_marker_path(repo_root);

	let raw: string;
	try {
		raw = await readFile(marker_path, "utf8");
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return null;
		}
		throw error;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new CollectionBindingMismatchError(
			`${QMD_MARKER_RELATIVE_PATH} exists at ${repo_root} but is not valid JSON. Delete or repair the marker before relying on it.`,
			error,
		);
	}

	const result = qmd_repo_marker_schema.safeParse(parsed);
	if (!result.success) {
		throw new CollectionBindingMismatchError(
			`${QMD_MARKER_RELATIVE_PATH} exists at ${repo_root} but does not match schema_version 1. ${result.error.issues[0]?.message ?? "The marker is invalid."}`,
			result.error,
		);
	}

	return result.data;
}

export async function write_repo_marker(cwd: string, marker: QmdRepoMarker): Promise<void> {
	const repo_root = await resolve_repo_root(cwd);
	const marker_path = get_marker_path(repo_root);
	await mkdir(path.dirname(marker_path), { recursive: true });
	await writeFile(marker_path, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function is_collection_for_repo(collection: QmdCollectionRecord, repo_root: string): boolean {
	return normalize_path_separators(collection.pwd) === normalize_path_separators(repo_root);
}

function build_marker_mismatch_warning(
	repo_root: string,
	marker: QmdRepoMarker,
	collection: QmdCollectionRecord,
): string {
	if (!is_collection_for_repo(collection, repo_root)) {
		return build_repair_warning(
			`The local marker points at '${marker.collection_key}', but that collection now resolves to ${collection.pwd} instead of ${repo_root}.`,
		);
	}

	if (marker.collection_key !== collection.name) {
		return build_repair_warning(
			`The local marker points at '${marker.collection_key}', but the store binding for this repo is '${collection.name}'.`,
		);
	}

	return build_repair_warning(`The local marker for ${repo_root} no longer matches the QMD store binding.`);
}

export async function detect_repo_binding(cwd: string): Promise<RepoBindingResult> {
	const repo_root = await resolve_repo_root(cwd);
	const expected_collection_key = collection_key_from_repo_root(repo_root);

	let marker: QmdRepoMarker | null = null;
	let marker_warning: string | undefined;
	try {
		marker = await read_repo_marker(repo_root);
	} catch (error) {
		marker_warning = get_error_message(error);
	}

	if (marker) {
		if (marker.repo_root !== repo_root) {
			marker_warning = build_repair_warning(
				`The local marker claims this repo root is ${marker.repo_root}, but the current normalized repo root is ${repo_root}.`,
			);
		} else if (marker.collection_key !== expected_collection_key) {
			marker_warning = build_repair_warning(
				`The local marker uses legacy collection key '${marker.collection_key}'. v1 expects '${expected_collection_key}' for this repo path.`,
			);
		}
	}

	let collections: QmdCollectionRecord[];
	try {
		collections = await list_collections();
	} catch (error) {
		return {
			status: "unavailable",
			repo_root,
			reason: get_error_message(error),
		};
	}

	const marker_collection = marker
		? (collections.find((collection) => collection.name === marker.collection_key) ?? null)
		: null;
	const repo_collection = collections.find((collection) => is_collection_for_repo(collection, repo_root)) ?? null;

	if (
		marker &&
		marker_collection &&
		is_collection_for_repo(marker_collection, repo_root) &&
		marker.collection_key === marker_collection.name
	) {
		return {
			status: "indexed",
			repo_root,
			collection_key: marker_collection.name,
			marker,
			source: "marker",
			repair_warning: marker_warning,
		};
	}

	if (repo_collection) {
		return {
			status: "indexed",
			repo_root,
			collection_key: repo_collection.name,
			marker,
			source: "store",
			repair_warning: marker
				? (marker_warning ?? build_marker_mismatch_warning(repo_root, marker, repo_collection))
				: undefined,
		};
	}

	if (marker && marker_collection) {
		return {
			status: "not_indexed",
			repo_root,
			marker,
			repair_warning: marker_warning ?? build_marker_mismatch_warning(repo_root, marker, marker_collection),
		};
	}

	return {
		status: "not_indexed",
		repo_root,
		marker: marker ?? undefined,
		repair_warning: marker_warning,
	};
}
