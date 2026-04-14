# Todos Extension

File-based todo management for Pi with:

- `todo` tool (for agent automation)
- `/todos` command (interactive TUI workflow)
- assignment/claiming support to avoid multi-session collisions

The extension stores todos in `.pi/todos/`.

## Features

- Create/update/append/delete todos
- Claim/release todos per active session
- Track status (`open`, `closed`, etc.)
- Interactive todo browser/action menu via `/todos`
- Quick prompt handoff actions ("work" / "refine") from TUI

## Tool API

Tool name: `todo`

Supported actions:
- `list`, `list-all`, `get`
- `create`, `update`, `append`, `delete`
- `claim`, `release`

ID format:
- Display: `TODO-<hex>`
- Input: accepts `TODO-<hex>` or raw `<hex>`

## Command

`/todos [search]`

Opens an interactive UI to:
- filter/select todos
- view full details
- copy todo path/text
- claim/release
- close/reopen
- delete
- prefill editor with "work on todo ..." or "refine ..." prompts

## Lifecycle

On `session_start`, the extension:
1. ensures `.pi/todos/` exists
2. loads todo settings
3. runs lightweight garbage collection

## File Structure

```
todos/
├── index.ts               # Extension entrypoint
├── tool.ts                # `todo` tool definition + renderers
├── command.ts             # `/todos` command and interactive flow
├── storage.ts             # file I/O, locking, claiming, settings
├── helpers.ts             # id parsing, filtering, prompt helpers
├── formatting.ts          # compact/expanded rendering helpers
├── constants.ts
├── types.ts
├── components/
│   ├── todo-selector.ts
│   ├── todo-action-menu.ts
│   ├── todo-detail-overlay.ts
│   └── todo-delete-confirm.ts
└── README.md
```

## Notes

- This extension is the main reference pattern in this repo for a complete tool + command + TUI implementation.
- Claim tasks before working and close them when complete to keep multi-session workflows clean.
