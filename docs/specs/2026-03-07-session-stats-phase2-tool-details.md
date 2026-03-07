# Session Stats Phase 2 — Tool Details & Two-Column Panel

Status: Approved
Todo: (none yet)
Date: 2026-03-07
Depends on: [[docs/specs/2026-03-07-session-stats-extension.md]]
Execution plan: [[docs/exec-plans/active/2026-03-07-session-stats-phase2-tool-details.md]]

## 1. Problem Statement

The session-stats panel (phase 1) shows per-tool call counts, but not *what* each tool did. A user can see "bash was called 18 times" but not *which CLI programs* were invoked. They can see "Read was called 10 times" but not *which files* were read — making it impossible to verify that the right context (docs, specs, skill files) was loaded before coding.

Desired end state:
- Selecting a tool in the panel reveals its argument details in a side-by-side detail column.
- Bash tool shows CLI program frequency breakdown.
- Read/Edit/Write tools show unique file lists, categorized by role (docs, skills, tests, code).
- Tool coverage shows how many of the available tools were actually used.
- The panel uses a two-column master-detail layout navigable with vim keys.

## 2. Goals and Non-Goals

### 2.1 Goals

- **Tool coverage**: display "Used X/Y tools" in the summary row, sourced from `pi.getAllTools()`.
- **Per-tool argument extraction**: parse `ToolCall` blocks from assistant messages in session entries to extract:
  - **bash**: CLI program names from `arguments.command`
  - **Read**: file paths from `arguments.path`
  - **Edit**: file paths from `arguments.path`
  - **Write**: file paths from `arguments.path`
  - **expertise**: action + domain from `arguments.action`, `arguments.domain`
  - **todo**: action from `arguments.action`
- **Bash command parsing**: split command strings on `&&`, `||`, `;`, `|` → extract first token of each segment as the CLI program name. Handle env var prefixes (`KEY=val cmd` → `cmd`). This covers ~90%+ of real usage.
- **File categorization** for Read files:
  - `docs/` prefix, `*.md`, `README*`, `AGENTS.md` → **docs**
  - `*SKILL.md`, `skills/` prefix → **skills**
  - `__tests__/`, `*.test.ts`, `*.spec.ts` → **tests**
  - Everything else → **code**
- **Two-column master-detail panel**: left column shows tool call bar chart with selectable rows; right column shows detail for the selected tool. `h/l` or `←/→` switches column focus; `j/k` or `↑/↓` navigates within the focused column.
- **Wider panel**: ~85 columns (up from 62) to accommodate two columns.

### 2.2 Non-Goals

- Tool execution timing (deferred to phase 3).
- Widget mode — persistent display above/below editor (deferred to phase 3).
- Edit diffs or content inspection — only file paths, not what was changed.
- Bash command argument parsing beyond the program name (e.g., extracting flags or target paths).
- Semantic grouping of CLI programs by category (e.g., "VCS", "Build") — too opinionated/fragile.

## 3. System Context

All changes are within `extensions/session-stats/`. No new files — this extends existing modules.

```text
extensions/session-stats/
├── index.ts          # pass pi.getAllTools() to panel; no other changes
├── constants.ts      # new panel width constant
├── types.ts          # new fields on SessionStats, new ToolDetail type
├── tracker.ts        # extract tool call arguments from assistant messages
├── panel.ts          # two-column layout, master-detail navigation
├── README.md         # update with new features
└── __tests__/
    └── tracker.test.ts  # new tests for argument extraction + bash parsing
```

Integration points:
- **Session entries** (existing): `ctx.sessionManager.getBranch()` — now also reads assistant message `content` array for `ToolCall` blocks.
- **`pi.getAllTools()`** (new): called from `index.ts` to get available tool count/names, passed to panel alongside stats.

## 4. Domain Model

### New types

```ts
/** Detail data extracted from tool call arguments */
interface ToolDetails {
  /** bash: CLI program name → invocation count */
  bash_programs: Map<string, number>;
  /** Read/Edit/Write: unique file paths seen */
  read_files: string[];
  edit_files: string[];
  write_files: string[];
  /** expertise: action → domain list */
  expertise_actions: Map<string, string[]>;
  /** todo: action → count */
  todo_actions: Map<string, number>;
}

/** File category for read files */
type FileCategory = "docs" | "skills" | "tests" | "code";
```

### Extended SessionStats

```ts
interface SessionStats {
  // ... existing fields ...
  /** Extracted argument details per tool */
  tool_details: ToolDetails;
  /** Total available tools in session (from pi.getAllTools()) */
  available_tool_count: number;
  /** Names of all available tools */
  available_tool_names: string[];
}
```

Note: `available_tool_count` and `available_tool_names` are **not populated by `reconstruct_stats()`** — they're injected by `index.ts` after reconstruction, since `pi.getAllTools()` is only available on `ExtensionAPI`, not in session entries.

### Tracker API additions

```ts
/** Extract CLI program names from a bash command string */
function extract_bash_programs(command: string): string[];

/** Categorize a file path as docs/skills/tests/code */
function categorize_file(path: string): FileCategory;

/** Group file paths by category, sorted within each group */
function group_files_by_category(paths: string[]): Map<FileCategory, string[]>;
```

`reconstruct_stats()` is extended to also walk assistant message `content` arrays, extracting `ToolCall` arguments into `tool_details`.

## 5. Detailed Design

### 5.1 Argument Extraction

During the existing `reconstruct_stats()` walk over session entries, when an entry is an assistant message, iterate its `content` array looking for objects with `type === "toolCall"`:

```ts
case "assistant": {
  stats.turn_count += 1;
  // ... existing loop detection ...

  // NEW: extract tool call arguments
  const content = message.content as Array<{ type: string; name?: string; arguments?: Record<string, any> }>;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "toolCall" && block.name && block.arguments) {
        extract_tool_call_detail(stats.tool_details, block.name, block.arguments);
      }
    }
  }
  break;
}
```

`extract_tool_call_detail()` dispatches by tool name:

| Tool name | Extraction |
|---|---|
| `Bash` | `extract_bash_programs(args.command)` → increment `bash_programs` map |
| `Read` | `args.path` → add to `read_files` set |
| `Edit` | `args.path` → add to `edit_files` set |
| `Write` | `args.path` → add to `write_files` set |
| `expertise` | `args.action` + `args.domain` → add to `expertise_actions` |
| `todo` | `args.action` → increment `todo_actions` |

### 5.2 Bash Command Parsing

`extract_bash_programs(command: string): string[]`:

1. Split `command` on `&&`, `||`, `;`, `|` (using regex: `/\s*(?:&&|\|\||[;|])\s*/`).
2. For each segment, trim whitespace.
3. Skip empty segments.
4. Handle env var prefixes: while the first token matches `/^\w+=\S*/`, skip it.
5. Take the first remaining token as the program name.
6. If the token contains `/` (a path like `/usr/bin/env`), take only the basename.
7. Return array of program names (may contain duplicates from a single command — caller aggregates).

Edge cases accepted as "good enough":
- `$(subshell)` — won't parse the inner command; token starts with `$` → included as-is (rare, acceptable).
- Heredocs, multiline strings — the command string from tool call arguments is typically a single logical command.
- `env FOO=bar cmd` — `env` shows up as the program; acceptable.

### 5.3 File Categorization

`categorize_file(path: string): FileCategory`:

| Pattern | Category |
|---|---|
| Starts with `docs/` or `doc/` | `docs` |
| Ends with `.md` | `docs` |
| Filename is `README` (any extension) or `AGENTS.md` | `docs` |
| Starts with `skills/` or contains `/SKILL.md` | `skills` |
| Contains `__tests__/` or ends with `.test.ts`, `.spec.ts`, `.test.js`, `.spec.js` | `tests` |
| Everything else | `code` |

Matching is case-sensitive, applied to the raw path from tool arguments.

### 5.4 Two-Column Panel Layout

```
╭─────────────────────────────────────┬───────────────────────────────────────────╮
│ ◉ Session Stats        duration 5m  │ Bash Commands (18)                        │
│ ─────────────────────────────────── │                                           │
│ 8 turns  3 loops  0 compactions     │   git       ████████████  8               │
│ 3 prompts  1 !cmd  Tools: 4/6      │   bun       ██████        4               │
│ ─────────────────────────────────── │   grep      ████          3               │
│ Tool Calls  42 total, 1 error       │   find      ██            2               │
│                                     │   cd        █             1               │
│ ▸ bash   ████████████████  18       │                                           │
│   Read   ██████████       10        │                                           │
│   Edit   ██████            6  1 err │                                           │
│   Write  ████              4        │                                           │
│                                     │                                           │
│ ─────────────────────────────────── │                                           │
│ Models                              │                                           │
│   ▸ Claude 4 Sonnet — current       │                                           │
│ ─────────────────────────────────── │───────────────────────────────────────────│
│  esc close · r refresh · h/l ←→ · j/k ↕                                        │
╰─────────────────────────────────────┴───────────────────────────────────────────╯
```

**Panel structure:**
- **Left column** (~37 chars inner width): header, summary, tool bar chart, models. Tool rows are selectable — the selected tool is highlighted with `▸` and accent color.
- **Right column** (~41 chars inner width): detail view for the selected tool. Content changes based on left selection.
- **Vertical divider**: `│` character separating the two columns, spanning from the first tool row to the footer.
- **Header and footer**: span the full width (not split).
- **Panel width**: ~85 chars total (was 62).

**Right column content by selection:**

| Selected tool | Right column title | Right column content |
|---|---|---|
| bash | "Bash Commands (N)" | Program frequency bar chart (same `█` style) |
| Read | "Files Read (N)" | File list grouped by category (docs / skills / tests / code) with category headers |
| Edit | "Files Edited (N)" | Unique file list (ungrouped, sorted alphabetically) |
| Write | "Files Written (N)" | Unique file list (ungrouped, sorted alphabetically) |
| expertise | "Expertise (N)" | Actions grouped: `get: [domain1, domain2]`, `reflect: [domain3]` |
| todo | "Todo Actions (N)" | Action → count: `create: 3, update: 2, list: 5` |
| *(no detail)* | — | Dimmed hint: "← select a tool to see details" |

**Navigation:**

| Key | Context | Action |
|---|---|---|
| `j/k`, `↑/↓` | Left column focused | Move tool selection up/down; right column updates |
| `j/k`, `↑/↓` | Right column focused | Scroll right column content independently |
| `h/l`, `←/→` | Any | Switch focus between left and right columns |
| `esc`, `q` | Any | Close panel |
| `Ctrl+Alt+T` | Any | Toggle panel (close if open) |
| `r` | Any | Refresh stats (re-reconstruct from session) |
| `g` / `G` | Right column focused | Jump to top / bottom of right column |

**Focus indicator**: the focused column's border or header uses accent color; the unfocused column uses dim/muted.

### 5.5 Scrolling Model

- **Left column**: scrolls if the tool list + models + summary exceeds the panel height. In practice this is unlikely (would need 20+ distinct tools).
- **Right column**: scrolls independently. Scroll position resets when the left selection changes. File lists can be long (50+ files in an active session).
- Scroll indicators (line range like `1-20/45`) shown in the footer for the right column when scrolling is active.

### 5.6 Available Tools Injection

`pi.getAllTools()` returns the current tool list. Since this is on `ExtensionAPI` (not in session entries), it can't be part of `reconstruct_stats()`. Instead:

```ts
// in index.ts
const build_stats = (ctx: ExtensionContext): SessionStats => {
  const branch = ctx.sessionManager.getBranch();
  const current_model = ctx.model ? { ... } : undefined;
  const stats = reconstruct_stats(branch, current_model);

  // Inject tool availability (not in session entries)
  const all_tools = pi.getAllTools();
  stats.available_tool_count = all_tools.length;
  stats.available_tool_names = all_tools.map(t => t.name);

  return stats;
};
```

## 6. Error Handling and Failure Modes

- **Missing `content` on assistant messages**: guard with `Array.isArray(content)` — some entries may lack it (e.g., after compaction). Skip silently.
- **Missing `arguments` on ToolCall**: skip — defensive `if (block.arguments)` check.
- **Bash command parsing failures**: if splitting/tokenizing produces no tokens, skip the segment. Never throw.
- **Very long file paths**: truncated to fit right column width via `truncateToWidth()`.
- **Tool name mismatch**: tool names in `ToolCall` blocks are case-sensitive as received from the model. If the model sends `"Bash"` vs `"bash"`, they'll appear as separate tools. We match against known tool names case-insensitively for detail extraction.

## 7. Testing Strategy

### 7.1 Unit Tests (tracker.test.ts)

New test groups:

- **`extract_bash_programs`**: simple command, chained `&&`/`||`, piped `|`, env var prefix, path-based program (`/usr/bin/env`), empty/whitespace input, complex one-liner.
- **`categorize_file`**: docs (`.md`, `docs/` prefix, `README`), skills (`SKILL.md`, `skills/`), tests (`__tests__/`, `.test.ts`), code (everything else).
- **`group_files_by_category`**: mixed paths produce correct grouping and sorting.
- **`reconstruct_stats` with tool call arguments**: assistant messages with `ToolCall` content blocks populate `tool_details` correctly.
- **Edge cases**: assistant message with no content array, ToolCall with missing arguments, multiple tool calls in one message.

### 7.2 Panel Testing

Manual verification only (TUI component). Test scenarios:
- Open panel, navigate tools with `j/k`, verify right column updates.
- Switch to right column with `l`, scroll long file list with `j/k`.
- Switch back with `h`, select different tool.
- Press `r` to refresh after more activity.

## 8. Implementation Checklist

- [ ] Add `ToolDetails` type and extend `SessionStats` in `types.ts`
- [ ] Add `extract_bash_programs()`, `categorize_file()`, `group_files_by_category()` to `tracker.ts`
- [ ] Extend `reconstruct_stats()` to extract tool call arguments from assistant messages
- [ ] Add new unit tests for all tracker additions
- [ ] Update panel width constant in `constants.ts`
- [ ] Refactor `SessionStatsPanel` to two-column layout with selectable tool rows
- [ ] Implement right column rendering per tool type
- [ ] Add `h/l` navigation for column focus switching
- [ ] Update `index.ts` to inject `pi.getAllTools()` data into stats
- [ ] Add "Tools: X/Y used" to summary row
- [ ] Update plain-text fallback in `build_plain_text_summary()`
- [ ] Update `README.md` with new features and key bindings
- [ ] Run `bun test extensions/session-stats` — all tests pass
- [ ] Run `bun run check` — no errors
- [ ] Manual verification in live Pi session

## 9. Open Questions

None — scope is well-defined based on brainstorming.
