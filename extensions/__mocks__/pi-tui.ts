// Minimal mock — only exports used in testable (Tier 1+2) modules

export function fuzzyMatch(pattern: string, text: string): { matches: boolean; score: number } {
	const lower_pattern = pattern.toLowerCase();
	const lower_text = text.toLowerCase();
	const matches = lower_text.includes(lower_pattern);
	return { matches, score: matches ? lower_pattern.length : 0 };
}

export function visibleWidth(text: string): number {
	return text.length;
}

export function truncateToWidth(text: string, width: number): string {
	return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}
