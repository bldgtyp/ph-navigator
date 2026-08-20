---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — Phases 00–01 complete; Phase 02 next
AUTHOR: Ed May / Codex
SCOPE: Product contract for bulk Assembly PDF export and public dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/README.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
---

# PRD — Assembly PDF and Public Dimensions

## 1. Problem

PHN has no printable all-Assemblies deliverable. Users must capture Assembly
drawings and material data individually. Separately, the public Assembly view
hides the left-side thickness dimensions because the current component treats
dimension visibility and dimension editing as the same permission.

## 2. Goals

- Download one PDF for the active project Version containing every Assembly.
- Put exactly one Assembly on each PDF page.
- Include a vector Assembly graphic and the Assembly's material table.
- Show layer-thickness dimension lines and values to anonymous viewers while
  keeping every mutation affordance unavailable.
- Share geometry, formatting, units, and material-color rules so browser and
  PDF representations cannot silently diverge.

## 3. PDF contract

### 3.1 Entry point and access

Add **Download assemblies PDF** to the existing
`aria-label="Assembly actions"` menu. Match the current HBJSON/PHPP export
policy:

- visible to signed-in editors, including while viewing a locked Version;
- absent for anonymous/read-only viewers;
- exports the saved Version, not an unsaved draft;
- uses `confirmDraftExport` before download when a draft is present;
- introduces `envelope.export.assembly_pdf` beside the existing per-surface
  Envelope export capabilities. It belongs to the same beta editor export
  bundle; do not reuse the broader raw `document.export` capability.

### 3.2 File and page composition

- One `.pdf` response and browser download, never a ZIP or one-file-per-Assembly
  batch.
- Assembly order is one portable natural-name order shared by sidebar and
  report; stored document insertion order is not the report order. Normalize
  names to Unicode NFKD, lowercase with the fixed `en-US` locale, split digit
  runs from text, compare digit runs numerically and text runs by Unicode code
  point, then use Assembly ID as the final tie-break. Replace the sidebar's
  environment-locale `Intl.Collator(undefined, ...)` behavior with this same
  contract so frontend/backend results cannot drift by host locale.
- With zero Assemblies, the menu item is disabled with explanatory copy. The
  protected route independently returns `422 no_assemblies`; it never emits a
  zero-page or explanatory-page PDF.
- Exactly one Assembly per US Letter landscape page. A4 and alternate
  orientations are deferred until a real deliverable requires them.
- Each page contains:
  1. project BT number/name and Version name;
  2. Assembly name and type;
  3. the complete Assembly drawing, fit without clipping;
  4. left-side thickness dimensions and interior/exterior orientation labels;
  5. the unique-material table matching `MaterialLegend` columns and active
     SI/IP units.
- The drawing remains vector in the PDF; material-table text remains text. A
  screenshot or rasterized full page is not acceptable.
- Fit adds a consistent page margin and drawing/table gap. Scaling is uniform;
  it must not distort layer or segment proportions.
- Missing material-property cells render as `—`. A page with any missing
  material or conductivity adds `Needs review: missing material data` below the
  table. Export does not fail an entire project because one Assembly is
  incomplete.
- Filename:
  `{bt-number}-assemblies-{units}-{version}.pdf`, sanitized through the shared
  response filename helpers.

The Moisture/condensation status is intentionally absent from this report until
that feature's public and reporting contract is fully supported.

## 4. Public dimension contract

The existing `AssemblyCanvasOverlay` gates the entire
`AssemblyLayerDimensions` tree behind `canEdit`. Split visibility from editing:

- every non-membrane layer renders its vertical dimension axis, ticks, and
  formatted thickness value for editors, locked-Version viewers, and anonymous
  viewers;
- editor mode retains the thickness button, delete button, and add-above/below
  controls;
- read-only mode renders semantic text, not a disabled button masquerading as
  content;
- membrane layers keep the existing rule: no thickness axis, ticks, or numeric
  label because the drawn band is not the membrane's physical thickness;
- read-only mode renders no delete or add controls and dispatches no commands;
- SI/IP formatting continues through `formatLengthFromMm`;
- the result matches Apertures' established pattern: geometry and dimensions
  remain visible while mutating controls disappear.

## 5. Technical shape

Create a presentation-level Assembly drawing model that owns:

- ordered layer/segment geometry;
- dimension-label values;
- material identity/color;
- orientation labels;
- page/table rows.

The PDF is composed server-side from a backend Assembly report projection. The
browser and backend cannot share runtime code, so a cross-language fixture
locks their ordered layers, segment proportions, thickness labels, orientation,
material rows, and missing-data flags. Do not separately re-derive dimensions
inside the PDF template after the report projection.

Phase 00 must select and prove a PDF renderer. Current dependencies can read
PDFs but do not provide a production PDF composition path. The proof must show
vector rectangles/lines, embedded fonts, selectable table text, deterministic
page breaks, and Render-compatible execution before the dependency is accepted.

## 6. Acceptance criteria

- A project with N Assemblies downloads one PDF with exactly N pages.
- A project with zero Assemblies has a disabled menu item and receives the
  stable `no_assemblies` route error if called directly.
- Every page names the correct Assembly and contains its full drawing and
  unique-material table.
- A very thick, very thin, segmented, and membrane-containing Assembly all fit
  without clipping or distorted proportions.
- Output is deterministic for the same saved Version and units.
- An editor with a dirty draft sees the existing saved-Version warning before
  export.
- A locked-Version editor can export.
- An anonymous viewer cannot see the export menu or invoke the protected route.
- An anonymous viewer can see every applicable thickness axis/value and cannot
  find or activate thickness edit, add-layer, or delete-layer controls.
- Focus order contains no inert editing controls in read-only mode.

## 7. Non-goals

- Per-Assembly PDF files or page selection.
- Page-size/orientation controls.
- Printing attachment PDFs or documentation evidence.
- Moisture/condensation reporting.
- Changing Assembly thermal calculations or material data.
