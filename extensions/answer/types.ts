/**
 * Type definitions for the Q&A extraction extension.
 *
 * Defines the structured output format returned by the LLM when
 * extracting questions from assistant messages.
 */

// ---------------------------------------------------------------------------
// Extraction result types
// ---------------------------------------------------------------------------

/** A single question extracted from an assistant message. */
export interface ExtractedQuestion {
	/** The question text to present to the user. */
	question: string;
	/** Optional context that helps the user answer the question. */
	context?: string;
}

/** The structured JSON output returned by the extraction LLM call. */
export interface ExtractionResult {
	questions: ExtractedQuestion[];
}
