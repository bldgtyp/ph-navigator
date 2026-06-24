---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: In progress — autonomous parts done 2026-06-24; PHPP paste + Playwright walkthrough await Ed
AUTHOR: Ed (via Claude)
SCOPE: End-to-end verification, PHPP paste validation, closeout gate, docs.
RELATED: ../PRD.md (§10 acceptance), ../decisions.md (open Q-A…Q-C)
---

# Phase 4 — Verify, validate paste, docs, closeout

> **Progress (2026-06-24).** Done autonomously: the closeout gate (`simplify` +
> `docs-pass` run per phase, full `make ci` green — backend + 1874 frontend
> tests + build), the `context/ui/pages/envelope-tab.md` docs fold-back, and the
> decisions fold-back (Q-D/E/F/G locked by the implementation in `decisions.md`).
> **Still needs Ed / a running stack:** §1 real PHPP copy/paste to lock the soft
> cells Q-A/Q-B/Q-C, and §2 the Playwright E2E walkthrough. The deterministic
> backend route tests + frontend EnvelopePage tests already cover the §10
> acceptance criteria short of the manual PHPP-paste alignment.

## 1. PHPP paste validation (locks the open cells)

- Export a real project's assemblies (SI and IP), open a CSV, and **paste into
  an actual PHPP U-Values worksheet**. Adjust the column placement of the
  percentages row and the right-side labels (decisions **Q-A**) until paste
  lands cleanly. Confirm **Q-B** (IP annotation on every row?) and **Q-C**
  (percentage precision) against PHPP behavior. Update `PRD.md` §4 + golden
  tests with the final layout.

## 2. End-to-end walkthrough (webapp-testing / Playwright)

Baseline from `context/ENVIRONMENT.md` (:5173 / :8000, sign in as
`codex@example.com`). Per `planning/features/.instructions.md`, prefer
Playwright for deterministic auth/assertions; the in-app Browser for visual
screenshots.

- SI: menu → download → unzip → one CSV per assembly, values correct.
- IP: toggle units, re-export → inch annotations present.
- Error case: craft/seed an assembly with > 8 layers (and one with > 3
  pathways) → modal lists them with reasons; Cancel aborts; Download-anyway
  yields a zip whose error CSVs carry the message and whose good CSVs are
  intact.
- Draft warning fires when an unsaved draft exists.
- Verify against `PRD.md` §10 acceptance list.

## 3. Closeout gate (CLAUDE.md)

1. `simplify` skill on the diff.
2. `docs-pass` skill on the diff.
3. `make format` (root).
4. `make ci` (substantial change → run it).
5. If `make format` changed files, re-inspect + rerun `make ci`.
6. No red steps before "done".

## 4. Docs fold-back

- `context/ui/pages/envelope-tab.md` — document the second "…" item and the
  modal.
- If any contract changed, update the relevant `context/` doc in the same pass
  (per `planning/.instructions.md` rule 4). Likely none beyond the UI page —
  no schema/data-model change.
- Update `STATUS.md` → `Merged to main` / `Complete` with evidence; fold the
  resolved open questions (Q-A…Q-G) into `decisions.md`.

## Done when

Acceptance criteria pass, a real PHPP paste round-trips, the closeout gate is
all-green, and docs reflect the shipped behavior.
