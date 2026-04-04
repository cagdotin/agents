/**
 * Constants for the Q&A extraction extension.
 *
 * Contains the system prompt used for question extraction and
 * preferred model identifiers for the extraction call.
 */

// ---------------------------------------------------------------------------
// Model preferences
// ---------------------------------------------------------------------------

/** Preferred extraction model – fast and cheap. */
export const CODEX_MODEL_ID = "gpt-5.1-codex-mini";

/** Fallback extraction model when Codex is unavailable. */
export const HAIKU_MODEL_ID = "claude-haiku-4-5";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * System prompt that instructs the LLM to extract questions from
 * conversational text and return them as structured JSON.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return {"questions": []}

Example output:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;
