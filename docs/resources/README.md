---
title: Resources Index
description: >
  System-of-record index for external articles/videos/resources that inform our
  agentic coding practices. Each resource file is structured for agent discovery,
  fast scanning, and reuse.
tags:
  - index
  - resources
---

# Resources

This directory stores curated external resources (videos, articles, talks, repos)
that can inspire or improve how we build agent workflows, skills, and extensions.

## Why this exists

To keep external learning **in-repo and discoverable** instead of buried in chats,
bookmarks, and memory. Resources are written for both humans and coding agents.

## Capture Workflow

1. Create a new file in this directory using kebab-case naming.
2. Start from `TEMPLATE.md`.
3. Fill required frontmatter fields.
4. Add:
   - concise summary
   - extracted links + why they matter
   - relevance to this repository
   - optional follow-up actions
5. Add the new file to the index section below.

## Frontmatter Schema

| Field | Required | Description |
|-------|----------|-------------|
| `title` | ✅ | Human-readable title |
| `type` | ✅ | `video`, `article`, `paper`, `talk`, `repo`, `thread` |
| `source` | ✅ | Platform/source (`youtube`, `blog`, `arxiv`, etc.) |
| `url` | ✅ | Original URL |
| `author` | ✅ | Creator name |
| `date_published` | ⬚ | Publication date |
| `date_captured` | ✅ | Date documented in this repo |
| `tags` | ✅ | Discovery tags |
| `related` | ⬚ | Wiki links to related resources/extensions/docs |
| `status` | ✅ | `captured`, `reviewed`, `applied` |
| `impact` | ⬚ | `foundational`, `informative`, `experimental` |
| `description` | ✅ | Short scan-friendly summary |

## Status Meanings

- **captured** - source recorded, minimal processing
- **reviewed** - summarized with takeaways and relevance notes
- **applied** - resulted in concrete repository changes

---

## Resource Index

### Foundational

- [[agent-experts-indydevdan]] — Persistent agent mental models and reflection loops.
- [[architecture-md-matklad]] — Why every project needs an ARCHITECTURE.md: codemap,
  invariants, boundaries. The structural blueprint for our own architecture doc.
- [[harness-engineering-openai]] — OpenAI's agent-first engineering playbook (map-not-manual,
  progressive disclosure, mechanical enforcement, entropy management).
- [[codex-exec-plans-openai]] — OpenAI Cookbook guidance on execution plans as living
  rollout artifacts (scope, milestones, progress, decision logging).
- [[pi-vs-claude-code-indydevdan]] — Harness customization tiers and practical extension strategy.

### Informative

- [[context-engineering-dex]] — Context-budget discipline, compaction, and RPI workflow.
- [[deep-modules-ai-ready-codebase]] — Deep modules for AI-ready codebases: simple interfaces,
  graybox internals, progressive disclosure. Reinforces module boundary enforcement.

### Experimental

*(none yet)*
