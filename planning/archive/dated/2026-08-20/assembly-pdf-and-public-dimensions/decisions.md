---
DATE: 2026-08-19
TIME: 23:00 EDT
STATUS: Accepted — Phase 00 renderer and page contract
AUTHOR: Codex
SCOPE: Assembly PDF composition dependency and fixed page geometry
RELATED:
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/PRD.md
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/PLAN.md
---

# Decisions — Assembly PDF and Public Dimensions

## PDF renderer: ReportLab 5

Use ReportLab's `pdfgen` canvas for the Assembly report. The Phase 00 proof
demonstrates deterministic US Letter landscape output, vector rectangles and
rules, embedded Vera TrueType fonts, selectable table text, and explicit
one-call page breaks. The dependency installs from the committed `uv.lock`
under the existing Render `uv sync --frozen --no-dev` build; no operating-system
packages or browser process are added.

The executable proof is `render_renderer_proof()` in
`backend/features/envelope/assembly_pdf.py`; its generated artifact is kept in
gitignored `working/assembly-pdf-renderer-proof.pdf`. The automated test checks
the embedded font stream, absence of raster image objects, deterministic bytes,
page count, and extracted text. ReportLab documents both direct vector canvas
operations and embedded TrueType fonts in its official
[graphics](https://docs.reportlab.com/reportlab/userguide/ch2_graphics/) and
[font](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/) guides.

Rejected alternatives:

- WeasyPrint: HTML/CSS layout is attractive, but its official installation
  path requires Pango/Harfbuzz system libraries. That expands the current
  Render native-Python runtime for a fixed technical report.
- fpdf2: capable of vector drawing and embedded Unicode fonts, but it offers no
  material advantage over ReportLab for this direct-canvas layout and would
  require a second proof.
- Browser screenshot/print-to-PDF: violates the vector drawing contract and
  adds a browser runtime to the backend.

## Fixed page contract

- Page: US Letter landscape, 792 × 612 points.
- Margin: 36 points on all sides; drawing/table gap: 24 points.
- Scale: one uniform drawing scale per page, fit inside the allotted drawing
  box; membrane bands remain the documented presentation exception.
- Table columns mirror `MaterialLegend`: Color, Material, conductivity or
  resistivity according to SI/IP units, Density, Specific heat, Emissivity.
- Version title comes from the persisted Version record used to load the saved
  document, never from a draft label.
- Filename parts use `download_filename_part()` and the response uses the
  shared download response helpers.

The final composer may factor the proof function away, but these constants and
testable output properties remain the accepted contract.
