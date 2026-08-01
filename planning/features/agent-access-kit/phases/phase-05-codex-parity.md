---
DATE: 2026-08-01
TIME: 12:58 EDT
STATUS: Ready — Phase 04 source/generator and bridge are published
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Codex — global MCP registration + AGENTS.md workflow section.
RELATED: ../PRD.md §5.2, ../decisions.md §D-8, ./phase-04-claude-plugin.md
---

# Phase 05 — Codex parity

## Goal

Codex launched in any project folder has the same PHN access and workflow
knowledge as Claude Code, from the same source of truth. This is a
first-class deliverable, not best-effort: Ed uses Codex regularly alongside
Claude Code (§D-13).

## Deliverables

1. **Global `~/.codex/config.toml` MCP entry** for
   `https://api.ph-nav.com/mcp`, same credential file
   (`~/.config/phn/credentials.json`), same launcher/header mechanism chosen
   in Phase 04. Named `phn`; must not collide with this repo's
   `.codex/config.toml` `phn-local` entry.
2. **`~/.codex/AGENTS.md` section** carrying the `phn` skill content
   (project resolution, draft lifecycle, error recovery, credential
   bootstrap) — emitted by the same generator as the plugin skill (§D-8).
3. **Install/update script** (Claude-executed, per the credentials rule):
   idempotently writes/updates both files on a machine; used for Ed's and
   John's machines.

## Notes

- Codex has no plugin system; global config + AGENTS.md *is* the
  distribution. The generator makes drift a build error rather than a chore.
- The Phase-03 template `AGENTS.md` in each project folder stays thin and
  generic; the global section carries the workflow.

## Done when

Fresh `codex` session in the Linde folder answers a project-data question
from production with no per-session setup (PRD §7 criterion 4).
