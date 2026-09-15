---
DATE: 2026-09-14
TIME: 19:13 EDT
STATUS: Merged to main via PR #97 (2026-09-14); deploy pending Ed
AUTHOR: Claude (with Ed May)
SCOPE: Desktop bearer reads for the active Frame Type and Glazing Type catalogs
RELATED: planning/archive/desktop-catalog-read/, context/technical-requirements/api.md#desktop-catalog-reads, context/mcp.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/96
---

# Desktop window catalog read

Adds `GET /api/v1/desktop/catalogs/frame-types` and
`GET /api/v1/desktop/catalogs/glazing-types` beside the existing desktop
Materials read, so **PH-Navigator for SketchUp** can browse and bookshelf
frames and glazings with the `catalog:read` grant it already holds.

**Behavior contract:** issue [#96](https://github.com/bldgtyp/ph-navigator/issues/96)
(response envelopes, auth/privacy rules, acceptance checks). It is complete
enough to serve as the PRD; this packet adds only the implementation sequence,
test design, and the decisions the issue leaves open.

**Precedent:** [`archive/desktop-catalog-read/`](../../archive/desktop-catalog-read/STATUS.md)
(issue #90, PR #91). This change is additive to that slice: no migration, no
new scope, no new SQL.

**Consumer:** `bldgtyp/ph-navigator-sketchup` branch `codex/w1-window-types`
(commit `92edfd5`), `planning/window-types/phases/phase-8f-frame-glazing-libraries-evidence.md`.
Its adapters already hard-code the two paths and `library_id` literals
(`src/ph_navigator_sketchup/features/library_sources/kinds/window_products.rb`)
and treat `psi_g_w_mk` as signed.

Read order: [STATUS.md](STATUS.md) → [PLAN.md](PLAN.md).
Branch: `feature/desktop-window-catalog-read`.
