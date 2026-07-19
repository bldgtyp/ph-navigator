---
DATE: 2026-07-18
TIME: 17:37
STATUS: Complete / archived implementation plan
AUTHOR: Ed May (with Claude)
SCOPE: High-level implementation sequence for documentation-tab
RELATED: PRD.md, decisions.md, assets/wireframe.html, phases/,
         planning/archive/dated/2026-07-19/heat-pump-display-name/
---

# Documentation tab — implementation plan

**Visual contract:** `assets/wireframe.html` (v2.1). **Behavior contract:**
`PRD.md` (settled). Read both plus `research.md` before any phase.

## Sequence

| Phase | Scope | Depends on |
|---|---|---|
| 0 | `heat-pump-display-name` (separate feature folder — survey + fix) | — |
| 1 | Backend: document schema — `photo_asset_ids` + waiver fields on all families; registry entries; `Specification Status` display rename | — |
| 2 | Backend: HEIC convert-on-upload; `documentation-summary` endpoints | 1 |
| 3 | Frontend: proximate photo columns on Equipment / Apertures / TB surfaces | 1 |
| 4 | Frontend: Documentation page — viewer-first (route, tab, sections, grid, rollup, filters, redirect, record modal) | 2, (0 for HP identity) |
| 5 | Frontend: editor affordances (uploads, spec select, waivers, unsaved hint) + directions content + polish | 3, 4 |
| 6 | Verification + docs pass (context page doc, e2e smoke, GLOSSARY) | 5 |

Phases 1–2 (backend) and 3 (frontend columns) can proceed in parallel after
Phase 1 lands. Phase 0 only gates the heat-pump rows' identity on the page —
it can land any time before Phase 4 ships.

## Standing rules for every phase

- All derivation/counting in the backend (hard rule); frontend renders.
- Reuse the attachment backbone — no new upload primitives. Photos use
  `SITE_PHOTO_ATTACHMENT_CONFIG` / `site_photo` kind everywhere.
- Feature branch off `main`; `main` stays deployable; no deploys (Ed's
  call only). Closeout gate per repo CLAUDE.md (simplify, docs-pass,
  `make format`, `make ci`).
- Verify with the agent browser (`make agent-browser-ready`,
  `frontend/scripts/agent-browser.mjs`) as codex@example.com; remember the
  dev seed project belongs to ed@example.com — use the AGENT-BROWSER
  fixture, don't sign in as Ed.
- Document-schema changes must follow the settled schema-migration
  mechanism (all new fields default-valued so old saved versions validate).
