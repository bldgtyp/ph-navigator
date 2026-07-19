---
DATE: 2026-07-19
TIME: 09:46 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8) for Ed May
---

# STATUS — Spec-status value unification

## Current state

Planning only. No code written for this refactor.

Prerequisite already shipped (2026-07-19 documentation UI session, on branch
`codex/documentation-page-redesign`):
- Shared `StatusSelect` component + `StatusSelect.css` (token-driven pill).
- Documentation + Envelope/Materials both render via `StatusSelect`.
- Envelope/Materials **displays** "Needed" (label-only) while still storing
  `"missing"` — this refactor closes that value gap.

## Next step

Phase 0 — decide the document schema migration mechanism (schema-version
upgrade 7 → 8 vs read-time alias). Record in `decisions.md`.

## Blockers / open questions

- Migration approach for stored JSONB (Phase 0 decision).
- Keep `--report-status-missing` color-token name, or rename to
  `--report-status-needed`? (cosmetic-key decision, Phase 2).
- Whether to also collapse the `DocumentationSpecStatus` `unknown` sentinel
  (out of scope unless trivial once values align).

## Verification checklist (fill in as phases land)

- [ ] Old v7 body with `specification_status: "missing"` reads back as `needed`.
- [ ] `SpecificationStatus` = `complete | needed | question | na` (backend + FE).
- [ ] Translation shims removed / reduced to identity.
- [ ] Apertures, Envelope, Equipment, Thermal Bridges show one option set.
- [ ] `make ci` green; migration regression test added.
