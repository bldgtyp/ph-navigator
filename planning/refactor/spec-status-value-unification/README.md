---
DATE: 2026-07-19
TIME: 09:46 EDT
STATUS: Not started — planning only
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Rename the built-in specification-status value "missing" → "needed" so
  every discipline (Apertures, Envelope, Equipment, Thermal Bridges) shares one
  status vocabulary end-to-end (backend enum + stored JSONB + frontend), and
  retire the backend "missing"→"needed" translation shims.
RELATED:
  - context/DATA_STORAGE.md (versioned JSONB documents)
  - context/technical-requirements/ (document schema-migration mechanism)
  - backend/features/project_document/document.py (CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 7)
  - Prompted by the 2026-07-19 documentation-page UI session, which unified the
    *display* label ("Missing" → "Needed") on the Envelope/Materials page but
    left the stored value as "missing" (label-only fix).
---

# Spec-status value unification (`missing` → `needed`)

Router for a cross-cutting refactor. Read order: this file → `PRD.md`
(why + contract) → `PLAN.md` (phased sequence) → `STATUS.md` (current
state / next step).

## One-paragraph problem

The built-in `SpecificationStatus` enum uses the value **`"missing"`**, but the
Documentation page (and the DataTable status option ids) speak **`"needed"`**.
Today the backend papers over this with translation tables that rewrite
`missing → needed` only for the documentation/status-summary feeds
(`documentation_summary.py:220`, `status_summary.py:234`). The result: the same
underlying state is called `missing`/"Missing" on Envelope/Materials and
Apertures, but `needed`/"Needed" on Documentation. We want a single value —
**`needed`** — everywhere, so Apertures, Envelope, Equipment, and Thermal
Bridges are truly unified rather than reconciled by a shim.

## Why this is its own refactor (not part of the UI work)

The UI session already unified the **display** (shared `StatusSelect`
component + "Needed" labels). What remains is a **value/data** change: the
canonical enum member and, critically, **every saved project-document version's
JSONB** currently stores `"specification_status": "missing"`. Changing the
enum without migrating stored data breaks reads. That migration rides the
document schema-version mechanism and is the real work here.

## Scope at a glance

| Layer | What changes |
| --- | --- |
| Backend enum | `SpecificationStatus` literal `"missing"` → `"needed"` (`envelope_models.py:27`) + all `= "missing"` defaults |
| Stored JSONB | Schema-version bump + upgrade that rewrites `missing → needed` in every row that carries `specification_status` |
| Backend shims | Delete/relax the `missing → needed` translation in `documentation_summary.py` + `status_summary.py` (becomes identity) |
| Frontend types | `SpecificationStatus` union + `ReportStatusKey` `"missing"` → `"needed"` |
| Frontend labels | Envelope/Materials already shows "Needed"; align the internal value + `report-status-*` key naming |
| MCP / import | `hbjson_import.py` validation set; any importer that emits `"missing"` |

## Out of scope

- The shared `StatusSelect` component and its pill styling (already shipped in
  the 2026-07-19 UI session).
- The `report-status-*` **color tokens** (orange/teal/green/grey) — only the
  *key name* `missing` may be renamed, not the colors.
- Equipment / Thermal Bridges *custom-status* option ids (`opt_status_needed`
  et al.) already use "needed"; confirm, don't rewrite.
