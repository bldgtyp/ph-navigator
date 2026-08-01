---
DATE: 2026-08-01
TIME: 13:19 EDT
STATUS: Complete — global Codex MCP/instructions installed and locally verified
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
from production with no per-session setup (PRD §7 criterion 4). The local
equivalent is verified here; production remains the explicit Phase-06 gate.

## Completion evidence

- Public installer commit `66c1ee4` plus CI-stability follow-up `2ca47aa`
  pushed to `bldgtyp/claude-plugins`; GitHub Actions run `30710065404` passed.
- Public `make check` passed: 24 tests plus generation, hygiene, compileall,
  and vendored MCP-contract drift checks. Three-lens simplify review ended
  with no remaining findings.
- `scripts/install_codex.py` stages one immutable, content-hashed runtime
  release, preserves existing global files/permissions, manages bounded
  sections atomically, refuses unmanaged `phn` TOML in all valid spellings,
  injects the exact installed login command, is no-op idempotent, and retains
  one fallback release.
- The installer ran twice against Ed's real `~/.codex`: resulting TOML parsed,
  `codex mcp get phn` showed the enabled stdio server, the installed launcher
  exists, and the global AGENTS section has exactly one marker pair.
- A fresh headless Codex 0.139 session launched in `0000 Folder Tree` with
  `-m gpt-5.5` plus explicit local endpoint/credential overrides, loaded the
  global `phn` server, called `phn/list_projects`, and returned the isolated
  local agent-browser fixture. Its temporary user token was revoked.
- The first attempt using Ed's configured `gpt-5.6-sol` default was rejected by
  Codex 0.139 as requiring a newer CLI. That is outside the MCP install, but
  Phase 06 must upgrade Codex or select a supported model before its Codex run.
- The first read attempt encountered a closed local HTTP connection; Codex
  retried the known-safe read and succeeded. The bridge correctly did not
  auto-replay the indeterminate POST.
- No PH-Navigator production deployment or Linde read/write was performed.
