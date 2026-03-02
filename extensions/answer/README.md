
# Answer – Q&A Extraction Extension

Forked from: https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/answer.ts
Repository: https://github.com/mitsuhiko/agent-stuff

Extracts questions from the last assistant message and presents an
interactive TUI for answering them. Once submitted, the compiled
answers are sent back as a user message and a new assistant turn is
triggered automatically.

## Usage

| Trigger       | Description                        |
|---------------|------------------------------------|
| `/answer`     | Command – extract & answer         |
| `Ctrl+Q`      | Shortcut – same flow               |

## How It Works

1. The handler scans the current session branch for the last complete
   assistant message.
2. A lightweight extraction model (Codex mini → Haiku → current model)
   is used to parse questions out of the text as structured JSON.
3. An interactive Q&A component is shown in the TUI where the user
   can navigate between questions and type answers.
4. On submit, the answers are formatted and sent as a message with
   `triggerTurn: true` so the assistant continues the conversation.

## File Structure

```
answer/
├── index.ts                  # Extension entry – registers command & shortcut
├── command.ts                # Command handler – orchestrates the full flow
├── extraction.ts             # Model selection & LLM extraction call
├── helpers.ts                # ANSI colors, message scanning, answer formatting
├── types.ts                  # TypeScript interfaces (ExtractedQuestion, etc.)
├── constants.ts              # System prompt & model IDs
├── components/
│   └── qna-component.ts     # Interactive Q&A TUI component
└── README.md
```
