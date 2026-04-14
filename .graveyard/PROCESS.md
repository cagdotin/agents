# Graveyard Process

How to retire an extension (or other module) so it can be rebuilt from scratch if revived.

---

## When to use

Use this process when removing a feature that:
- has non-trivial implementation worth documenting
- might be revived later under different constraints
- is referenced across docs, specs, or other modules

Do **not** use this for deleting throwaway experiments or one-file utilities — just delete those and note the removal in a commit message.

---

## Steps

### 1. Create the graveyard folder

Create `.graveyard/<category>/<name>/` where `<category>` matches the source location (e.g., `extensions`, `skills`, `lib`).

### 2. Write a rebuild spec

Write `.graveyard/<category>/<name>/spec.md` — a self-contained specification that an agent or developer can use to rebuild the feature from scratch without access to the original source code.

The spec should cover:
- **Purpose** — what problem the feature solved and for whom
- **User-facing surface** — commands, tools, UI components, keyboard shortcuts
- **Data model** — file formats, schemas, storage locations
- **Lifecycle** — Pi hooks used, initialization, cleanup
- **Key behaviors** — sorting, filtering, locking, garbage collection, validation
- **Dependencies** — Pi APIs, external libraries, peer extensions
- **Design decisions** — trade-offs made and why (e.g., file-based vs DB, YAML vs JSON)

If the feature is large, split into multiple spec files (e.g., `spec-storage.md`, `spec-tui.md`).

The goal is **enough detail to rebuild**, not a line-by-line translation of the old code.

### 3. Collect and summarize references

Search the repo for all references to the retired module in:
- `docs/` (architecture, quality, references, contributing)
- `docs/specs/` and `docs/exec-plans/`
- `AGENTS.md`, `README.md`
- `skills/`
- other extensions

Write `.graveyard/<category>/<name>/references.md` summarizing what was referenced and where. This serves as a cleanup checklist and historical record.

### 4. Clean up live references

For each reference found in step 3:
- **Remove** references that are purely about the retired module
- **Rewrite** references that mention the module alongside still-live content
- **Leave** references in completed specs/exec-plans as historical record (they describe what was true at the time)

### 5. Delete source code

Once the spec and references are written, delete the source code entirely. The spec is the artifact — the graveyard folder should contain only documentation, not code.

```
rm -rf extensions/<name>/
```

Do **not** move source code into the graveyard. The spec exists precisely so the feature can be rebuilt without the original source.

### 6. Update the graveyard index

Add an entry to `.graveyard/<category>/README.md` following the existing format:
- Extension name as heading
- Removed date
- What it did (1-2 sentences)
- Why it was retired (1-2 sentences)

### 7. Remove from package manifest

If the module is registered in `package.json` (extensions array, etc.), remove it.

### 8. Commit

Group the changes into logical commits:
1. Add graveyard spec and references
2. Clean up live doc references
3. Delete source code and update graveyard index
