---
DATE: 2026-08-01
TIME: 10:03 EDT
STATUS: Complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 4 — fold accepted decisions back into context/.
RELATED: ../PRD.md, ../decisions.md, ./phase-03-sweep.md
---

# Phase 4 — Docs fold-back

Per `planning/.instructions.md` rule 4, accepted decisions must land in
`context/` in the same docs pass.

## Edits

| Target | Change |
| --- | --- |
| `backend/features/access/capabilities.py` docstring | The "beta collapses to today's binary behavior" paragraph is now wrong for project scope. State that project reach is owner-or-`projects.access.all`, and that global capability bundles no longer imply reach to an arbitrary project |
| `backend/features/projects/access.py` docstring | Same — "anonymous → client, any session → member" now needs the ownership qualifier |
| `context/technical-requirements/` (access/auth doc) | Record the access matrix from `PRD.md` §2 as the current contract |
| `context/ui/pages/viewer-public.md` | Note that anonymous reach is unchanged and now has a regression guard, with a pointer to why (§D-5) |
| `context/GLOSSARY.md` | `projects.access.all`, and "owner" as a defined project relationship |
| `planning/archive/dated/2026-06-27/access-capability-model/PRD.md` | Do **not** edit — archived. Reference it from the new docs instead (archive is append-only) |
| `backend/features/catalogs/access.py:5` | Stale: says `catalog.edit` comes "from an explicit grant, the Admin preset, or `is_staff`". In live code `MEMBER_CAPS` includes it, so **every signed-in member** holds it. Correct the docstring; change no behavior (§D-8) |

## Deferred v2.0 packets — keep them honest

These are not archived, so they must not be left describing a world this
refactor changed.

| Target | Change |
| --- | --- |
| `planning/features_v2.0/multi-tenant-teams/STATUS.md` | R1's **owner-half is now done**. Its §2 line refs (`access.py:62-66`, `routes.py:110-127`) are already stale — repoint them and note what R1 still owns: teams, `team_id` scoping, cross-tenant denial, removing anonymous view |
| `planning/features_v2.0/access-capability-enforcement/PRD.md` §2 | Two stale claims: `STAFF_EXTRA_CAPS` **does not exist** in code, and `MEMBER_CAPS` **does** include `catalog.edit`. Also record that `is_staff` is now load-bearing (it resolves `projects.access.all`) rather than inert |
| `planning/features_v2.0/access-capability-enforcement/PRD.md` §3 | Note the interim `projects.access.all` and that its Admin-preset clause is a bridge to be deleted when `staff` / team-`admin` become real (§D-3) |

Do not promote or re-date either packet — they stay deferred. This is a
correctness edit so the next reader does not plan work that is already done.

## Memory

The repo memory note `project_access_model_review_2026_06_27.md` says the
boundary is a per-project `access_mode` field and "no per-project membership
yet". After this lands that is half stale: signed-in reach is now ownership-
gated, while the anonymous/public question is still open and still wants
`access_mode`. Update that note rather than adding a second one.

## Closeout

Then the standard gate from `CLAUDE.md`:

1. `simplify` skill on the diff
2. `docs-pass` skill on the diff
3. `make format`
4. `make ci`
5. Re-inspect and rerun if format touched anything

## Exit criteria

- No doc still claims any signed-in user is a member of every project.
- Packet `STATUS.md` records the verified implementation state without claiming
  a merge that has not happened; the packet is archived after the final gate.
- The dependent feature's `STATUS.md` unblocked.

## Completion evidence

Completed 2026-08-01.

- Updated both access module docstrings, the catalog-access docstring, the
  canonical PRD/access matrix, auth requirements, MCP contract, data-model
  owner comment, public-viewer narrative, and glossary.
- Corrected the deferred access-capability PRD and multi-tenant STATUS without
  promoting or re-dating either deferred feature.
- Updated the two user-owned dependent feature STATUS files to show that the
  implementation dependency is satisfied on this branch, while retaining the
  honest requirement to merge before starting them from `main`.
- Searched the repository for `project_access_model_review_2026_06_27.md`; no
  such repo memory note exists, so no duplicate or invented note was created.
  The stale contract instead lived in canonical `context/PRD.md`,
  `context/GLOSSARY.md`, and `context/technical-requirements/data-model.md`, all
  corrected here.
- The final three-way simplify review and docs pass completed after correcting
  over-broad seam language, MCP destructive-operation wording, stale catalog
  capability wording, and duplicated volatile inventory counts.
- `make format` changed nothing, `graphify update .` completed, and full
  `make ci` passed (backend 1,754 passed / 7 skipped; frontend 2,365 passed;
  production build green). The same evidence is recorded in `STATUS.md`.
