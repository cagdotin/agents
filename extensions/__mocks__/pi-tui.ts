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

// ── Key matching mock ────────────────────────────────────────────
// Maps raw terminal input bytes to key identifiers for panel tests.

const KEY_MAP: Record<string, string> = {
	"\x1b": "escape",
	"\x1b[A": "up",
	"\x1b[B": "down",
	"\x1b[H": "home",
	"\x1b[F": "end",
	"\x1b[5~": "pageUp",
	"\x1b[6~": "pageDown",
	"\r": "enter",
	"\n": "enter",
	"\x03": "ctrl+c",
	"\t": "tab",
	" ": "space",
	"\x7f": "backspace",
};

export function matchesKey(data: string, keyId: string): boolean {
	// Check direct byte mapping
	const mapped = KEY_MAP[data];
	if (mapped === keyId) return true;

	// Single printable character keys (letters, digits, symbols)
	if (data.length === 1 && keyId.length === 1 && data === keyId) return true;

	// shift+letter: uppercase letter matches shift+lowercase
	if (data.length === 1 && keyId.startsWith("shift+") && keyId.length === 7) {
		const base = keyId[6];
		if (base && data === base.toUpperCase() && data !== base) return true;
	}

	return false;
}

// ── Text wrapping mock ───────────────────────────────────────────

export function wrapTextWithAnsi(text: string, width: number): string[] {
	if (width <= 0) return [text];
	const lines: string[] = [];
	const input_lines = text.split("\n");
	for (const input_line of input_lines) {
		if (input_line.length <= width) {
			lines.push(input_line);
			continue;
		}
		// Simple word-break wrapping
		const words = input_line.split(/(\s+)/);
		let current = "";
		for (const word of words) {
			if (current.length + word.length <= width) {
				current += word;
			} else if (current.length > 0) {
				lines.push(current);
				current = word.trimStart();
			} else {
				// Single word longer than width — hard break
				for (let i = 0; i < word.length; i += width) {
					lines.push(word.slice(i, i + width));
				}
			}
		}
		if (current.length > 0) {
			lines.push(current);
		}
	}
	return lines.length > 0 ? lines : [""];
}
