---
DATE: 2026-07-28
UPDATED: 2026-07-29
TIME: 22:52 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 3 — service + route + the header chip + the "what's missing"
  modal state. After this phase the feature is usable.
RELATED: ../PRD.md §5/§6.1/§6.2/§7, ../decisions.md §D-3/§D-5,
  context/ui/pages/envelope-tab.md, context/DESIGN_SYSTEM.md
---

# Phase 3 — Route, chip, and the "what's missing" state

## Goal

Every assembly header shows a live condensation chip; clicking it opens the
modal, which for now has one fully built state — **"what's missing"** — plus
a placeholder verdict body. At launch-coverage levels the blocked state is
the most common one, so it ships first and best.

## Work

### Backend

1. **`condensation_settings` on `ProjectAssumptions`**
   (`project_document/document.py`) per PRD §5 — a second field on the
   existing block (do **not** create a sibling), `X | None = None`, additive,
   no schema bump; defaults resolved via `resolved_assumptions()`. Write path
   rides the existing draft/save spine.
2. **Service edge** (`envelope/service.py` or a condensation sibling):
   resolve the live draft assembly + materials, the project's attached
   climate record, the film table for the document's `thermal_standard`
   (typed-unavailable 409 precedent applies), and resolved settings — then
   call the engine. No lookups inside the engine (AC 13).
3. **Input hash + cache** — the §6.4 checklist, treated as a checklist:
   assembly subtree + referenced materials' vapour & thermal fields +
   material `category` + `thermal_standard` + `exterior_condition` + climate
   source identity + the whole `condensation_settings` block (AC 14).
   `thermal_input_hash`'s two near-misses are the cautionary tale.
4. **Route** — `GET /api/v1/projects/{id}/assemblies/{assembly_id}/condensation`
   returning the full result in one payload (all tiers' data; it is small).
   Blocked/not-screened states are 200s with a status field, not errors
   (AC 2).

### Frontend

5. **The chip** in `AssemblyHeader` beneath Effective U-Value: all eight §6.1
   states, `report-status-chip` tone family (the canonical chip pattern),
   `InfoTooltip` matching the Thickness/U-Value pattern, every state
   clickable. A caveated clear renders muted-success with a caveat count,
   never full-confidence green (AC 9 chip-side).
6. **Modal shell** — `ModalDialog` + `DialogActions`, wide, `.pill-tab-list`
   tier switching wired but tiers 1–4 stubbed with a compact verdict summary
   (the full tiers are Phases 4–5).
7. **The "what's missing" state** (§6.2): per offending material — name, the
   layer(s) it sits on, which datum is missing (µ/sd; membranes say "sd
   required"), and an inline affordance to enter the value (open the material
   editor pre-focused on the Vapour group). "Needs a climate source"
   deep-links to the Climate tab (E-7). Not-screened states say why in one
   sentence.
8. **Freshness** — chip computed against the live draft; editing a layer
   updates it without reload (AC 5; TanStack Query invalidation keyed on the
   input hash's client-side analogue).

## Out of scope

Tiers 1–4 content (charts, tables, assumptions editing); MCP; Status-tab
roll-up.

## Verification

- AC 2, 5, 6 (zero-config default computes), 12 (not-screened states), 14;
  AC 8's no-"pass"/"fail" rule holds for all chip copy.
- Focused backend tests: settings resolution, hash sensitivity matrix, 409
  path, blocked-state payloads.
- **Browser smoke via `frontend/scripts/agent-browser.mjs`** (both prerequisite
  packets found their real defects in a browser, not the suite): chip states,
  what's-missing list, the edit round-trip chip refresh, `--settle 1200` for
  persisted-state checks.
- `make ci` green.

## Result — 2026-07-29

Complete. The version-scoped condensation route resolves the requested live
draft or saved document, the project climate basis, the active surface-film
table, and zero-config or persisted assumptions at the service edge. Pure
results are cached in a bounded process-local FIFO by the complete input hash;
blocked and not-screened outcomes remain typed 200 responses.

The Assembly header now carries the eight-state clickable chip and wide
four-tab modal shell. The blocked state groups missing inputs by material and
layer, focuses µ for ordinary layers or direct sd for membranes, deep-links
missing climate to the Climate tab, and refreshes after envelope or climate
mutations. Ground and unconditioned-space states explain why they are outside
v1 screening.

Verification:

- 45 focused backend tests, including route states, hash-cache reuse, live
  draft refresh, climate priority, and the typed film-table 409.
- 65 focused frontend tests, including all eight chip states, keyboard tabs,
  ordinary µ focus, and membrane direct-sd focus.
- Live T3 browser roundtrip: clear µ/sd → `needs vapour data (1)` → corrective
  editor focus → enter µ → `needs a climate source`, without reload.
- Simplify review completed across reuse, quality, and efficiency.
- Full repository CI: backend `1714 passed, 7 skipped`; frontend `248` files /
  `2324` tests; production build and version-marker check green.
- `graphify update .` completed.
