import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore, type QMDStore } from "@tobilu/qmd";
import { QmdUnavailableError } from "./errors.js";
import type {
	QmdCollectionRecord,
	QmdContextRecord,
	QmdEmbedResult,
	QmdIndexStatus,
	QmdUpdateResult,
} from "./types.js";

let store_promise: Promise<QMDStore> | null = null;

function get_default_qmd_db_path(): string {
	const cache_root = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
	return path.join(cache_root, "qmd", "index.sqlite");
}

async function open_store(): Promise<QMDStore> {
	const db_path = get_default_qmd_db_path();
	await mkdir(path.dirname(db_path), { recursive: true });
	return createStore({ dbPath: db_path });
}

async function with_store<T>(action: string, fn: (store: QMDStore) => Promise<T>): Promise<T> {
	try {
		store_promise ??= open_store();
		const store = await store_promise;
		return await fn(store);
	} catch (error) {
		store_promise = null;
		throw new QmdUnavailableError(action, error);
	}
}

export async function close_store(): Promise<void> {
	if (!store_promise) {
		return;
	}

	try {
		const store = await store_promise;
		await store.close();
	} finally {
		store_promise = null;
	}
}

export async function list_collections(): Promise<QmdCollectionRecord[]> {
	return with_store("list QMD collections", async (store) => store.listCollections());
}

export async function add_collection(params: {
	collection_key: string;
	repo_root: string;
	glob_pattern?: string;
}): Promise<void> {
	await with_store(`add QMD collection '${params.collection_key}'`, async (store) => {
		await store.addCollection(params.collection_key, {
			path: params.repo_root,
			pattern: params.glob_pattern ?? "**/*.md",
		});
	});
}

export async function set_contexts(
	collection_key: string,
	paths: Array<{ path: string; annotation: string }>,
): Promise<void> {
	await with_store(`set QMD contexts for '${collection_key}'`, async (store) => {
		const current = (await store.listContexts()).filter((context) => context.collection === collection_key);
		const desired = new Map(paths.map((entry) => [entry.path, entry.annotation]));

		for (const context of current) {
			if (!desired.has(context.path)) {
				await store.removeContext(collection_key, context.path);
			}
		}

		for (const entry of paths) {
			await store.addContext(collection_key, entry.path, entry.annotation);
		}
	});
}

export async function list_contexts(): Promise<QmdContextRecord[]> {
	return with_store("list QMD contexts", async (store) => store.listContexts());
}

export async function update_collection(
	collection_key: string,
	on_progress?: (info: { collection: string; file: string; current: number; total: number }) => void,
): Promise<QmdUpdateResult> {
	return with_store(`update QMD collection '${collection_key}'`, async (store) =>
		store.update({
			collections: [collection_key],
			onProgress: on_progress,
		}),
	);
}

export async function embed_pending(
	on_progress?: (info: { current: number; total: number; collection?: string }) => void,
): Promise<QmdEmbedResult | null> {
	return with_store("generate pending QMD embeddings", async (store) => {
		const status = await store.getStatus();
		if (status.needsEmbedding <= 0) {
			return null;
		}
		return store.embed({ onProgress: on_progress });
	});
}

export async function get_status(): Promise<QmdIndexStatus> {
	return with_store("read QMD index status", async (store) => {
		const status = await store.getStatus();
		return {
			totalDocuments: status.totalDocuments,
			needsEmbedding: status.needsEmbedding,
			hasVectorIndex: status.hasVectorIndex,
			collections: status.collections.map((collection) => ({
				name: collection.name,
				path: collection.path,
				pattern: collection.pattern,
				documentCount: collection.documentCount,
			})),
		};
	});
}

export async function get_active_document_paths(collection_key: string): Promise<string[]> {
	return with_store(`get active document paths for '${collection_key}'`, async (store) => {
		return store.internal.getActiveDocumentPaths(collection_key);
	});
}

export interface QmdIndexHealthInfo {
	needs_embedding: number;
	total_docs: number;
	days_stale: number | null;
}

export async function get_index_health(): Promise<QmdIndexHealthInfo> {
	return with_store("get QMD index health", async (store) => {
		const health = await store.getIndexHealth();
		return {
			needs_embedding: health.needsEmbedding,
			total_docs: health.totalDocs,
			days_stale: health.daysStale,
		};
	});
}
