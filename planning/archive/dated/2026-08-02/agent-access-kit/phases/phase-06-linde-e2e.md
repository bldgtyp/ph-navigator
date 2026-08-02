---
DATE: 2026-08-02
TIME: 10:25 EDT
STATUS: Complete — all six production/local acceptance runs passed
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

## Outcome — 2026-08-02

1. **Claude cold start passed.** Ed approved the production device request;
   the bridge wrote a `0600` credential and Claude returned live Linde status.
   The first attempt exposed the 30-second Claude MCP timeout and Python 3.9
   compatibility gaps. Public plugin `0.1.1` fixed both in commit `72cb0f2`;
   `make check` passed 27 tests and GitHub Actions run `30751238058` passed.
2. **Claude warm read passed.** A fresh session used the stored credential with
   zero interactive steps and confirmed there was no starting draft.
3. **Write round-trip passed.** The Rooms row `109 — Office` temporarily became
   `Office [agent-access verification]` in the draft. `diff_versions` showed
   only that name plus its derived `computed.record_id`. `discard_draft`
   removed the draft; the saved `version_body_etag` remained exactly
   `b88bbd379f11403acc2120e3f40bdb37c784bdba46180b618b0d056b13fc347e`.
   No save/save-as/delete tool ran.
4. **Codex cold + warm passed.** Codex 0.139 used explicit model `gpt-5.5`.
   Ed approved a `(Codex)` credential on the cold run; a separate warm session
   called `get_project` without login and confirmed active version `Working`
   (`36cec711-bc53-497c-a999-99754d89e22b`) with no draft.
5. **Template hygiene passed.** A scratch copy retained the null marker, both
   generated instruction files, and all 14 numbered directories. A Codex agent
   matched local fixture `AGENT-BROWSER-92194C15D39D`, stamped only
   `phn_project_id`, preserved both production URLs, and verified the match via
   `get_project`. The scratch folder, credential, and three disposable local
   tokens were removed/revoked afterward.
6. **Scope regression passed.** `cd backend && uv run pytest
   tests/test_mcp.py::test_user_token_lists_and_round_trips_only_issuer_projects
   -q` returned `1 passed`; the test asserts cross-user access yields
   `project_not_found` with `recoverability: "refresh"` after a draft
   replace/discard round-trip.

PH-Navigator commit `1928562d436355e6000366766a78245cbf29d9b2` deployed through
GitHub Actions run `30750524962`; both API and web version markers reported that
exact SHA before production acceptance began.

## Resolved blockers

Ed explicitly authorized the merge, deployment, approval clicks, and Linde
draft-only verification. The production deployment and both runtime approvals
completed. Codex 0.139's unsupported configured default was handled by selecting
supported model `gpt-5.5` for the acceptance runs.

## Done when

All six runs passed; PRD §7 criteria are recorded in `STATUS.md`; the feature
is complete and archives per `planning/.instructions.md`.
