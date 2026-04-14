# Answer Extension — Rebuild Spec

Retired: 2026-04-04

## Purpose

LLM-powered Q&A extraction from assistant messages. Scanned the last assistant message for questions, extracted them as structured JSON via a lightweight model, then presented an interactive TUI for the user to answer each question. Submitted answers were sent back as a user message to continue the conversation.

Forked from: https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/answer.ts

## Reason for retirement

Low usage. Answers end up in chat directly — the TUI panel didn't add enough value over inline responses.

---

## User-facing surface

- `/answer` command — extract questions and open interactive Q&A
- `Ctrl+Q` shortcut — same flow

## Flow

1. Scan current session branch for the last complete assistant message
2. Select extraction model (preference: OpenAI Codex mini → Claude Haiku 4.5 → current session model). Model is only chosen if the registry has a valid API key for it.
3. Send assistant text to extraction model with a system prompt instructing structured JSON output
4. Parse response into `{ questions: [{ question, context? }] }` (Zod validated, handles markdown code fences)
5. Show interactive Q&A TUI component where user navigates between questions and types answers
6. On submit, format answers and send as a message with `triggerTurn: true`

## Data model

### Extraction result

```typescript
interface ExtractedQuestion {
  question: string;
  context?: string;  // optional context to help answer
}

interface ExtractionResult {
  questions: ExtractedQuestion[];
}
```

### Extraction system prompt

Instructs the LLM to extract questions requiring user input from conversational text, keep them in order, be concise, and return `{"questions": []}` if none found.

### Model preferences

- Primary: `gpt-5.1-codex-mini` (OpenAI Codex provider) — fast, cheap, good at structured output
- Fallback: `claude-haiku-4-5` (Anthropic provider)
- Last resort: current session model

## Dependencies

- `@mariozechner/pi-ai` — `complete()`, `Model`, `Api`, `UserMessage` types
- `@mariozechner/pi-tui` — TUI component infrastructure
- `zod` — extraction result validation
- Pi APIs: `pi.registerCommand()`, `pi.registerShortcut()`, `ctx.sessionManager.getBranch()`, `ctx.sendMessage()`, `ctx.ui.custom()`

## File structure at removal

- `index.ts` — registers command + shortcut
- `command.ts` — orchestrates full flow (scan → extract → TUI → send)
- `extraction.ts` — model selection + LLM call + JSON parsing
- `helpers.ts` — ANSI colors, message scanning, answer formatting
- `types.ts` — TypeScript interfaces
- `constants.ts` — system prompt + model IDs
- `components/qna-component.ts` — interactive Q&A TUI component
