---
DATE: 2026-08-20
TIME: 00:14 EDT
STATUS: Complete — all phases verified
AUTHOR: Codex
SCOPE: Phase plan for Assembly PDF and public dimensions
RELATED:
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/PRD.md
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/STATUS.md
---

# PLAN — Assembly PDF and Public Dimensions

## Phase 00 — Output proof and contract lock

**Status: Complete (2026-08-19).** ReportLab 5 selected; deterministic vector,
embedded-font, selectable-text proof generated and visually inspected. See
`decisions.md` and `backend/tests/envelope/test_assembly_pdf_renderer.py`.

- Build one disposable renderer spike from a representative Assembly fixture.
- Compare viable PDF composition paths against: vector output, selectable text,
  font embedding, deterministic layout, deployment footprint, and testability.
- Lock the page geometry, scale limits, MaterialLegend-equivalent columns,
  Version-name lookup, and shared response filename helper.
- Record the selected dependency and rejection reasons in `decisions.md` if the
  choice is not obvious from the final code.

Exit: a generated one-page artifact demonstrates the full non-raster contract.

## Phase 01 — Read-only Assembly dimensions

**Status: Complete (2026-08-19).** Locked and anonymous viewers now retain
non-membrane dimension axes and semantic thickness text while every thickness,
add-layer, and delete-layer control remains absent. Membranes retain their
editor controls but never expose a thickness dimension.

- Characterize the current editor dimension controls.
- Split dimension presentation from editor controls.
- Render read-only thickness axes/labels for locked and anonymous views.
- Add component tests proving that visible labels survive while all mutations
  disappear.

Exit: browser behavior matches the Apertures read-only pattern.

## Phase 02 — Canonical report model and PDF composer

**Status: Complete (2026-08-19).** Frontend/backend geometry now shares a
checked JSON projection fixture and portable natural ordering. The protected
saved-Version endpoint emits one deterministic vector Letter page per
Assembly, with SI/IP material data, incomplete-data review markers, stable
filenames, and coverage for membranes, legacy geometry, and extreme scale.

- Add the server-side report projection for all Assemblies in sidebar natural
  name order and a browser/backend parity fixture.
- Reuse unit formatting, material colors, status flags, and orientation rules.
- Implement the PDF response, content disposition, filename, and capability
  guard against a saved Version.
- Cover `422 no_assemblies`, incomplete Assemblies, membrane layers, duplicate
  material use, and extreme geometry.

Exit: deterministic N-Assembly/N-page backend tests pass.

## Phase 03 — Assembly actions integration

**Status: Complete (2026-08-19).** Editors can download the saved-Version PDF
in active SI/IP units from Assembly actions, including locked Versions. The
client honors the server filename, confirms dirty drafts, guards against the
saved Version's actual zero-Assembly count, cancels stale downloads, reports
errors, and keeps the action absent for viewers.

- Add the menu item and download hook.
- Reuse the saved-Version/draft warning and busy/error behavior from existing
  Envelope exports.
- Keep the menu hidden for viewers and available on locked Versions.

Exit: focused frontend tests cover visibility, warning, download, and errors.

## Phase 04 — Rendered acceptance and docs

**Status: Complete (2026-08-20).** The isolated local fixture passed unlocked,
locked, and anonymous browser checks in SI/IP; the final two-page vector PDF
was visually inspected without clipping. Full backend/frontend suites and all
static/build contract gates pass.

- Run `make agent-browser-ready` before localhost verification.
- Verify signed-in unlocked, signed-in locked, and signed-out Assembly routes.
- Inspect a multi-page PDF visually and assert page count/text in an automated
  PDF test.
- Run the focused frontend/backend gates, `graphify update .`, and docs pass.

Exit: all PRD acceptance criteria have direct evidence in `STATUS.md`.
