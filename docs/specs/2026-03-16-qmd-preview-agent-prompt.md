# QMD Search Result Preview — Agent Prompt

## Task

Add a **document preview view** to the QMD panel. When the user presses `enter` on a search result, the main pane switches from search results to a read-only rendered markdown preview of that document, scrolled to the relevant match location. The user can scroll with `j/k` and return to search results with `esc`/`h`/`←`.

## Before You Start

Read these files in order:

1. **`extensions/qmd/ui/panel.ts`** (~1420 lines) — The panel you'll modify. Search view is in `render_main_search()` and `handle_main_search_input()`. You'll add a new `"preview"` main view.
2. **`extensions/qmd/ui/data.ts`** — The `QmdSearchResult` type. Note the `file` field (virtual path like `qmd://collection/path.md`), `display_path`, `snippet`, and `source` fields.
3. **`extensions/qmd/core/qmd-store.ts`** — QMD SDK wrapper. You'll add a `get_document_content()` function here.
4. **`extensions/qmd/extension/command.ts`** — Wires callbacks. You'll add `on_get_document` callback.
5. **`extensions/qmd/ui/constants.ts`** — Panel dimensions (sidebar width 24, min width 90).

For the Pi TUI API: read `/Users/cgn/.local/share/mise/installs/node/23.3.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md`

Key TUI APIs: `matchesKey()`, `truncateToWidth()`, `visibleWidth()`, `TUI.requestRender()`, and `theme.fg(color, text)`.

## Architecture Overview

The panel already supports three main pane views dispatched in `render_main_pane()`:

```typescript
private render_main_pane(width: number, height: number): string[] {
    if (this.main_view === "overview") return this.render_main_overview(width, height);
    if (this.main_view === "files") return this.render_main_files(width, height);
    if (this.main_view === "search") return this.render_main_search(width, height);
    return this.render_main_overview(width, height);
}
```

You are adding a fourth view: `"preview"`. The pattern is the same — one render method, one input handler, one entry in the dispatcher.

## Implementation Steps

Work through these in order. The whole feature is a single milestone — it's self-contained.

### Step 1: Add document content callback

**`extensions/qmd/core/qmd-store.ts`** — Add a function to fetch document content:

```typescript
export async function get_document_content(
    virtual_path: string,
): Promise<{ content: string; title: string } | null> {
    return with_store("get document content", async (store) => {
        const doc = store.internal.findDocument(virtual_path, { includeBody: true });
        if (!doc || "error" in doc) return null;
        return { content: doc.body ?? "", title: doc.title };
    });
}
```

The QMD SDK's `findDocument()` accepts virtual paths (`qmd://collection/path.md`) and can include the body via `{ includeBody: true }`. The content is stored in the QMD SQLite database — no filesystem read required.

**Alternative approach — read from filesystem:** If the virtual path resolution doesn't work reliably, fall back to reading from disk. The collection's `repo_root` + the `display_path` gives you the filesystem path. For bound collections, `this.snapshot.repo_root` has the repo root. Use `readFile()` to get the content. This is simpler but only works for bound collections.

### Step 2: Add callback to panel interface

**`extensions/qmd/ui/panel.ts`** — Extend `QmdPanelCallbacks`:

```typescript
export interface QmdPanelCallbacks {
    // ... existing callbacks ...
    on_get_document: (virtual_path: string) => Promise<{ content: string; title: string } | null>;
}
```

### Step 3: Wire callback in command.ts

**`extensions/qmd/extension/command.ts`** — Add to `panel_callbacks`:

```typescript
on_get_document: async (virtual_path: string) => {
    const { get_document_content } = await import("../core/qmd-store.js");
    return get_document_content(virtual_path);
},
```

Or use a top-level import if the module is already imported.

### Step 4: Add preview state and view type

**`extensions/qmd/ui/panel.ts`** — Add to the class:

```typescript
// ── Preview state ────────────────────────────────────────
private preview_content: string[] = [];        // rendered lines (styled)
private preview_raw_lines: string[] = [];      // raw markdown lines (for line counting)
private preview_scroll_offset = 0;
private preview_title = "";
private preview_path = "";
private preview_target_line = 0;               // line to jump to (from search match)
private preview_loading = false;
```

Update the `main_view` type:

```typescript
private main_view: "overview" | "files" | "search" | "preview" = "overview";
```

### Step 5: Update the main pane dispatcher

```typescript
private render_main_pane(width: number, height: number): string[] {
    if (this.main_view === "overview") return this.render_main_overview(width, height);
    if (this.main_view === "files") return this.render_main_files(width, height);
    if (this.main_view === "search") return this.render_main_search(width, height);
    if (this.main_view === "preview") return this.render_main_preview(width, height);
    return this.render_main_overview(width, height);
}
```

### Step 6: Update the main pane label

In `get_main_pane_label()`:

```typescript
private get_main_pane_label(): string {
    const name = this.selected_collection_key ?? "Overview";
    if (this.main_view === "files") return `${name} › Files`;
    if (this.main_view === "search") return `${name} › Search`;
    if (this.main_view === "preview") return `${name} › Preview`;
    return name;
}
```

### Step 7: Change `enter` on search results to open preview

In `handle_main_search_input()`, find the block where `search_focus === "results"` handles `enter`:

**Current behavior:**
```typescript
if (matchesKey(key_data, "enter") || matchesKey(key_data, "y")) {
    const result = this.search_results[this.search_cursor];
    if (result) {
        this.copy_to_clipboard(result.display_path);
    }
    return;
}
```

**New behavior:**
```typescript
if (matchesKey(key_data, "enter") || matchesKey(key_data, "l") || matchesKey(key_data, "right")) {
    const result = this.search_results[this.search_cursor];
    if (result) {
        this.open_preview(result);
    }
    return;
}
if (matchesKey(key_data, "y")) {
    const result = this.search_results[this.search_cursor];
    if (result) {
        this.copy_to_clipboard(result.display_path);
    }
    return;
}
```

`y` still copies path. `enter`/`l`/`→` opens preview (consistent with sidebar's `enter`/`l`/`→` to drill in).

### Step 8: Implement `open_preview()`

```typescript
private async open_preview(result: QmdSearchResult): Promise<void> {
    this.preview_loading = true;
    this.preview_title = result.title || result.display_path;
    this.preview_path = result.display_path;
    this.main_view = "preview";
    this.tui.requestRender();

    try {
        const doc = await this.callbacks.on_get_document(result.file);
        if (!doc) {
            this.preview_raw_lines = ["", " Document not found."];
            this.preview_content = this.preview_raw_lines;
            this.preview_target_line = 0;
        } else {
            this.preview_raw_lines = doc.content.split("\n");
            this.preview_target_line = this.find_match_line(
                this.preview_raw_lines,
                result.snippet,
                this.search_query,
            );
            this.preview_content = this.render_markdown_lines(this.preview_raw_lines);
        }
    } catch {
        this.preview_raw_lines = ["", " Failed to load document."];
        this.preview_content = this.preview_raw_lines;
        this.preview_target_line = 0;
    }

    this.preview_loading = false;
    // Scroll to target line, centered in viewport
    // (actual centering happens in render_main_preview based on available height)
    this.preview_scroll_offset = Math.max(0, this.preview_target_line - 5);
    this.tui.requestRender();
}
```

### Step 9: Implement `find_match_line()`

Find the line in the document that best matches the search result's snippet or query:

```typescript
private find_match_line(lines: string[], snippet: string, query: string): number {
    // Strategy 1: Find the snippet text in the document
    if (snippet) {
        // Clean snippet (remove leading …, trim)
        const clean = snippet.replace(/^…/, "").replace(/…$/, "").trim();
        // Take first meaningful line of snippet
        const first_line = clean.split("\n")[0]?.trim();
        if (first_line && first_line.length > 10) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(first_line)) return i;
            }
            // Fuzzy: try a shorter substring
            const short = first_line.slice(0, 40);
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(short)) return i;
            }
        }
    }

    // Strategy 2: Find the query terms in the document
    if (query) {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (terms.length > 0) {
            let best_line = 0;
            let best_score = 0;
            for (let i = 0; i < lines.length; i++) {
                const lower = lines[i].toLowerCase();
                let score = 0;
                for (const term of terms) {
                    if (lower.includes(term)) score++;
                }
                if (score > best_score) {
                    best_score = score;
                    best_line = i;
                }
            }
            if (best_score > 0) return best_line;
        }
    }

    return 0; // Top of file
}
```

### Step 10: Implement `render_markdown_lines()`

Lightweight markdown rendering using theme colors. No external dependencies — just regex-based styling. This renders raw markdown lines into styled terminal strings.

```typescript
private render_markdown_lines(raw_lines: string[]): string[] {
    const t = this.theme;
    const styled: string[] = [];
    let in_code_block = false;
    let code_lang = "";

    for (const line of raw_lines) {
        // Code block fences
        if (line.trimStart().startsWith("```")) {
            in_code_block = !in_code_block;
            if (in_code_block) {
                code_lang = line.trimStart().slice(3).trim();
                styled.push(t.fg("dim", ` ${"─".repeat(3)} ${code_lang || "code"} ${"─".repeat(10)}`));
            } else {
                styled.push(t.fg("dim", ` ${"─".repeat(16)}`));
                code_lang = "";
            }
            continue;
        }

        // Inside code block — render as-is with dim/muted styling
        if (in_code_block) {
            styled.push(` ${t.fg("muted", line)}`);
            continue;
        }

        // Headings
        const h1 = line.match(/^# (.+)/);
        if (h1) {
            styled.push(` ${t.fg("accent", t.bold(h1[1]))}`);
            continue;
        }
        const h2 = line.match(/^## (.+)/);
        if (h2) {
            styled.push(` ${t.fg("accent", h2[1])}`);
            continue;
        }
        const h3 = line.match(/^### (.+)/);
        if (h3) {
            styled.push(` ${t.fg("warning", h3[1])}`);
            continue;
        }
        const h4_plus = line.match(/^#{4,}\s+(.+)/);
        if (h4_plus) {
            styled.push(` ${t.fg("muted", t.bold(h4_plus[1]))}`);
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            styled.push(t.fg("dim", " ─────────────────────"));
            continue;
        }

        // Unordered list items
        const ul = line.match(/^(\s*)[*\-+]\s+(.+)/);
        if (ul) {
            const indent = ul[1];
            styled.push(` ${indent}${t.fg("accent", "•")} ${this.style_inline_markdown(ul[2])}`);
            continue;
        }

        // Ordered list items
        const ol = line.match(/^(\s*)(\d+)\.\s+(.+)/);
        if (ol) {
            const indent = ol[1];
            styled.push(` ${indent}${t.fg("dim", `${ol[2]}.`)} ${this.style_inline_markdown(ol[3])}`);
            continue;
        }

        // Blockquote
        if (line.trimStart().startsWith("> ")) {
            const content = line.replace(/^\s*>\s?/, "");
            styled.push(` ${t.fg("dim", "│")} ${t.fg("muted", content)}`);
            continue;
        }

        // Blank line
        if (line.trim() === "") {
            styled.push("");
            continue;
        }

        // Normal paragraph text — apply inline styling
        styled.push(` ${this.style_inline_markdown(line)}`);
    }

    return styled;
}
```

### Step 11: Implement `style_inline_markdown()`

Handle inline markdown: bold, italic, inline code, links.

```typescript
private style_inline_markdown(text: string): string {
    const t = this.theme;

    // Process inline code first (to avoid conflicts with bold/italic inside code)
    let result = text.replace(/`([^`]+)`/g, (_match, code) => t.fg("muted", code));

    // Bold
    result = result.replace(/\*\*([^*]+)\*\*/g, (_match, bold) => t.bold(bold));
    result = result.replace(/__([^_]+)__/g, (_match, bold) => t.bold(bold));

    // Italic (after bold to avoid conflict)
    result = result.replace(/\*([^*]+)\*/g, (_match, italic) => t.fg("dim", italic));
    result = result.replace(/_([^_]+)_/g, (_match, italic) => t.fg("dim", italic));

    // Links: [text](url) → text (dim url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        (_match, link_text, url) => `${t.fg("accent", link_text)} ${t.fg("dim", `(${url})`)}`);

    return result;
}
```

### Step 12: Implement `render_main_preview()`

```typescript
private render_main_preview(width: number, height: number): string[] {
    const t = this.theme;
    const iw = width - 1; // left padding

    if (this.preview_loading) {
        const lines: string[] = ["", ` ${t.fg("muted", "Loading…")}`];
        while (lines.length < height) lines.push("");
        return lines;
    }

    const content = this.preview_content;
    const total = content.length;

    // Header: path and line position
    const path_display = display_key(this.preview_path, iw - 20);
    const pos_info = `${this.preview_scroll_offset + 1}–${Math.min(this.preview_scroll_offset + height - 2, total)}/${total}`;
    const header_left = ` ${t.fg("accent", path_display)}`;
    const header_right = `${t.fg("dim", pos_info)} `;
    const header_gap = Math.max(1, iw - visibleWidth(header_left) - visibleWidth(header_right));
    const header = truncateToWidth(`${header_left}${" ".repeat(header_gap)}${header_right}`, iw);

    const sep = t.fg("dim", "─".repeat(iw));

    // Body
    const body_h = Math.max(1, height - 2); // header + separator
    const max_scroll = Math.max(0, total - body_h);
    this.preview_scroll_offset = Math.max(0, Math.min(this.preview_scroll_offset, max_scroll));

    const visible = content.slice(this.preview_scroll_offset, this.preview_scroll_offset + body_h);

    // Highlight the target match line
    const target_in_view = this.preview_target_line - this.preview_scroll_offset;

    const body_lines: string[] = [];
    for (let i = 0; i < body_h; i++) {
        const line = visible[i] ?? "";
        if (i === target_in_view && this.preview_target_line > 0) {
            // Subtle highlight on the matched line — prepend a marker
            body_lines.push(truncateToWidth(`${t.fg("accent", "▸")}${line}`, iw));
        } else {
            body_lines.push(truncateToWidth(` ${line}`, iw));
        }
    }

    return [header, sep, ...body_lines].slice(0, height).map(l => truncateToWidth(l, width));
}
```

### Step 13: Implement preview input handler

```typescript
private handle_main_preview_input(key_data: string): void {
    // Back to search results
    if (matchesKey(key_data, "escape") || matchesKey(key_data, "h") || matchesKey(key_data, "left")) {
        this.main_view = "search";
        this.tui.requestRender();
        return;
    }

    // Scroll
    if (matchesKey(key_data, "j") || matchesKey(key_data, "down")) {
        this.preview_scroll_offset++;
        this.tui.requestRender();
        return;
    }
    if (matchesKey(key_data, "k") || matchesKey(key_data, "up")) {
        this.preview_scroll_offset = Math.max(0, this.preview_scroll_offset - 1);
        this.tui.requestRender();
        return;
    }
    if (matchesKey(key_data, "g") || matchesKey(key_data, "home")) {
        this.preview_scroll_offset = 0;
        this.tui.requestRender();
        return;
    }
    if (matchesKey(key_data, "shift+g") || matchesKey(key_data, "end")) {
        this.preview_scroll_offset = Math.max(0, this.preview_content.length - 10);
        this.tui.requestRender();
        return;
    }
    // Page up/down
    if (matchesKey(key_data, "ctrl+d") || matchesKey(key_data, "pagedown")) {
        this.preview_scroll_offset += 20;
        this.tui.requestRender();
        return;
    }
    if (matchesKey(key_data, "ctrl+u") || matchesKey(key_data, "pageup")) {
        this.preview_scroll_offset = Math.max(0, this.preview_scroll_offset - 20);
        this.tui.requestRender();
        return;
    }

    // Copy path
    if (matchesKey(key_data, "y")) {
        this.copy_to_clipboard(this.preview_path);
        return;
    }
}
```

### Step 14: Wire preview input into main input router

In `handle_main_input()`:

```typescript
private handle_main_input(key_data: string): void {
    if (this.main_view === "overview") {
        this.handle_main_overview_input(key_data);
    } else if (this.main_view === "files") {
        this.handle_main_files_input(key_data);
    } else if (this.main_view === "search") {
        this.handle_main_search_input(key_data);
    } else if (this.main_view === "preview") {
        this.handle_main_preview_input(key_data);
    }
}
```

### Step 15: Update the footer

In `render_footer()`, add the preview case:

```typescript
} else if (this.main_view === "preview") {
    hints.push(`${t.fg("accent", "←/h")} back`);
    hints.push(`${t.fg("accent", "j/k")} scroll`);
    hints.push(`${t.fg("accent", "g/G")} top/bottom`);
    hints.push(`${t.fg("accent", "y")} copy path`);
    hints.push(`${t.fg("accent", "esc")} search`);
}
```

Place this block **before** the search block in the footer logic (since preview is a sub-view of search).

### Step 16: Handle sidebar navigation while in preview

When the user selects a different collection in the sidebar, the preview should close. This is already handled — `select_sidebar_entry()` sets `main_view = "overview"`. But if the user presses `h`/`←` while in preview, it goes back to search. Pressing `h`/`←` again from search goes to sidebar. This is the correct cascade:

```
preview →(esc/h/←)→ search →(esc with empty query)→ overview →(esc/h/←)→ sidebar
```

No changes needed here — the existing cascade handles it.

## Key Design Decisions

- **`enter` opens preview, `y` copies path.** This is more useful than the previous behavior where `enter` copied path. Users who want the path can still use `y`.
- **Content comes from QMD store, not filesystem.** The document body is already in the SQLite database. This works for all collections (bound and external) without needing filesystem access.
- **Preview is read-only.** No editing, no modification. Just a viewer.
- **Match line focusing uses snippet-based heuristic.** We try to find the snippet text in the document first, then fall back to query term matching, then top of file. This is approximate but good enough — the user can scroll from there.
- **Markdown rendering is lightweight.** No external dependencies. Headings get accent colors, code blocks get dim styling, lists get bullet markers, inline code/bold/italic get styled. This is a preview, not a full renderer.
- **Scroll position persists when returning to preview.** If the user goes back to search and re-enters the same result, `open_preview` is called again which resets scroll — this is intentional (re-read).

## Rules

- **Do not modify** `toggle-state.ts`, `plain-text.ts`, or any existing test files.
- **Use `theme.fg()` for all colors.** Key names: `accent`, `dim`, `muted`, `warning`, `error`.
- **Use `t.bold()` for bold text.** It's available on the theme object.
- **Every line from `render()` must not exceed `width`.** Use `truncateToWidth()` on all output.
- **Reuse existing helpers** — `display_key()`, `pad_to_width()`, `truncateToWidth()`, `visibleWidth()`.
- **Package manager: Bun.** Use `bun run check`, `bun test`, never npm/yarn/pnpm.
- **Do not commit or push** without explicit user approval.

## Verification

After implementation:

1. `bun run check` passes — no type errors.
2. `bun test` passes — existing tests still work.
3. Manual testing:
   - Open `/qmd`, select a collection, press `s` to search.
   - Type a query and press `enter`.
   - Navigate results with `j/k`.
   - Press `enter` on a result → preview opens showing the rendered markdown.
   - Preview is scrolled to the match location (not top of file).
   - `j/k` scrolls the preview. `g`/`G` goes to top/bottom.
   - `esc` or `h` returns to search results (cursor position preserved).
   - `y` in preview copies the file path.
   - The footer shows preview-appropriate shortcuts.
   - Long documents scroll correctly without rendering artifacts.
   - Documents with code blocks, headings, lists render with proper styling.
