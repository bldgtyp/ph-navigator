---
DATE: 2026-08-01
TIME: 13:19 EDT
STATUS: Blocked — Phases 01–05 complete; needs production deploy + Ed present
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: End-to-end acceptance on the Linde Residence test case.
RELATED: ../PRD.md §7, ../decisions.md §D-9
---

# Phase 06 — Linde end-to-end acceptance

## Test case

- Dropbox folder: `/Users/em/Dropbox/bldgtyp/2524_Linde_Residence`
- Production project:
  `https://www.ph-nav.com/projects/2f2b0cbd-19b7-41cb-9e38-72593c34d699`

## Runs (PRD §7, in order)

1. **Cold start (Claude Code)** — credential file removed/renamed first.
   Open `claude` in the Linde folder, ask "what's the status of this project
   in PH-Nav?". Expect: marker discovered → device flow → Ed clicks
   **Approve** (only human action) → answer from live production data.
2. **Warm read** — same question, new session: zero interactive steps.
3. **Write round-trip** — a harmless draft edit, verified with
   `diff_versions(to="draft")`, then `discard_draft`. Assert afterwards that
   the active saved version's `version_body_etag` is unchanged. **No
   `save_draft` on Linde.**
4. **Codex cold + warm** — runs 1–2 under `codex`.
5. **Template hygiene** — copy `0000 Folder Tree` → scratch folder, open an
   agent, confirm the null-id bootstrap resolves/stamps (against a
   throwaway or local project, not Linde), then delete the scratch folder.
6. **Scope regression** — confirm on the local stack that a user token for one
   user gets `project_not_found` / `recoverability: "refresh"` on another
   user's project (backend suite from Phase 01 must already cover this; this
   run is a spot check). Not `forbidden` — see Phase 01 "Cross-user error
   contract" and ownership-enforcement §D-2.

## Safety rails

- Linde is a real client project on production: draft-only writes,
  `discard_draft` before ending any session, never `save_draft`/
  `save_draft_as`/delete tools.
- Ed present for the approval clicks and watching run 3.
- Record each run's transcript notes + screenshots under `./assets/` or
  `working/` and fold outcomes into `STATUS.md`.

## Current blocker

The user-token/device-flow commits on `codex/agent-access-kit` are not deployed
to PH-Navigator production. Running this phase requires explicit authorization
to merge/deploy that application change, followed by Ed being present for the
Claude and Codex approval clicks and watching the live-client draft round-trip.
Codex CLI 0.139 also rejects Ed's configured `gpt-5.6-sol`; upgrade it or select
a supported model for the production Codex run. Do not substitute local
evidence or deploy without authorization.

## Done when

All six runs pass; PRD §7 criteria checked off in `STATUS.md`; feature moves
to `Complete` and archives per `planning/.instructions.md`.
