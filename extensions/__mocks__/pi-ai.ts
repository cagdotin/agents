// Minimal mock — only exports used in testable (Tier 1+2) modules

import { Type as TypeboxType } from "@sinclair/typebox";

// Re-export the real StringEnum from typebox since it's used for schema declarations
export function StringEnum<T extends readonly string[]>(values: T) {
	return TypeboxType.Unsafe<T[number]>({ type: "string", enum: [...values] });
}

export async function complete() {
	throw new Error("complete() must be mocked per-test");
}

export type Api = any;
export type Model<_T = any> = { provider: string; id: string };
export type UserMessage = { role: "user"; content: any[]; timestamp: number };
