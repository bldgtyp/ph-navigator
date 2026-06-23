---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Backend export core — mapping, eligibility, CSV render, zip. Pure
  functions, no HTTP. New module `backend/features/envelope/phpp_export.py`.
RELATED: ../PRD.md (§4 layout, §6 eligibility, §7 mapping), ../research.md
---

# Phase 1 — Backend export core

Goal: a self-contained, fully-tested module that turns a `ProjectDocumentV1`
into per-assembly export plans, full-block CSV strings, and a zip — all in SI,
no HTTP, no I/O. (IP annotation + routes come in Phase 2.)

## New file: `backend/features/envelope/phpp_export.py`

Constants:
- `PHPP_MAX_UVALUE_ROWS = 8`  (decisions Q3)
- `PHPP_MAX_SECTIONS = 3`     (decisions Q1 / Q-G)
- `FRACTION_TOLERANCE = 1e-6` (for comparing split profiles)

Dataclasses / models (plain `@dataclass`, this is pure logic):
- `SectionAssignment`: `material_name: str | None`, `conductivity_w_mk: float | None`
- `ExportRow`: `sections: list[SectionAssignment]` (len = num_sections),
  `thickness_mm: float`
- `AssemblyExportPlan`:
  - `assembly_id`, `assembly_name`
  - `exportable: bool`
  - `reason: Literal["too_many_layers","too_many_pathways","incomplete_materials"] | None`
  - `rows: list[ExportRow]` (ext→int; empty if not exportable)
  - `section_percentages: list[float]` (len = num_sections)
  - `total_thickness_cm: float`
  - `u_value_w_m2k: float | None`

Functions:
- `build_assembly_export_plan(assembly, materials_by_id) -> AssemblyExportPlan`
  1. Order layers ext→int (reuse/replicate `_layers_outside_to_inside`).
  2. Completeness: if any segment lacks a material / conductivity / valid ref
     → `reason="incomplete_materials"` (use `thermal.thermal_issues` to detect).
  3. Row count: `len(layers) > PHPP_MAX_UVALUE_ROWS` → `too_many_layers`.
  4. Section resolution (§7):
     - per-layer width-fraction profile; uniform = `(1.0)`.
     - split layers must share one identical profile (compare with tolerance);
       else → `too_many_pathways`.
     - `num_sections = len(shared_profile)` (or 1); `> PHPP_MAX_SECTIONS`
       → `too_many_pathways`.
  5. Build `rows`: uniform layer → broadcast its (name, λ) across all sections;
     split layer → segment `i` → section `i`. `thickness_mm` per row.
  6. `section_percentages = shared_profile * 100`.
  7. `total_thickness_cm = sum(thickness_mm)/10`;
     `u_value_w_m2k = calculate_assembly_thermal(...).u_effective_w_m2k`.
  - Precedence when multiple failures: surface the most actionable
    (incomplete > too_many_layers > too_many_pathways — confirm ordering in
    review; only one reason is shown).
- `render_assembly_csv(plan, *, units="SI") -> str`
  - Exportable → full 7-column block (PRD §4) via `csv.writer` on
    `io.StringIO()` (positional rows, `QUOTE_MINIMAL`). λ 3-dp, thickness int,
    U 3-dp, total 1-dp, Rsi/Rse `0.00`, pad blank material rows to 8.
  - Not exportable → a 1-line CSV with the reason message (PRD §6). Phase 1
    renders SI only; `units` param wired but IP annotation lands in Phase 2.
- `sanitize_csv_filename(name) -> str` — strip/replace `/ \ : * ? " < > |`,
  collapse whitespace, trim, cap length; `.csv`.
- `build_phpp_zip(body, *, units="SI") -> bytes` — `io.BytesIO` +
  `zipfile.ZIP_DEFLATED`; one entry per assembly via `render_assembly_csv`;
  de-dupe filenames (`name (2).csv`).
- `phpp_preflight(body) -> list[AssemblyExportPlan]` — plans only (routes in
  Phase 2 project these to a JSON status list).

## Tests — `backend/features/envelope/tests/test_phpp_export.py`

(Match existing envelope test layout/fixtures; `uv run pytest`.)
- All-single-segment assembly → golden full-block CSV (the W-CS example:
  Concrete/Roxul/Roxul, U≈0.278, total 33.0). Lock the SI byte output.
- One consistent split through 2 layers → 2 sections, correct global %s,
  uniform layers broadcast across both sections.
- `> 8` layers → `too_many_layers` + error-CSV body, no data rows.
- Two layers split with **different** profiles → `too_many_pathways`.
- A layer with 4 segments → `too_many_pathways`.
- Segment missing material / conductivity → `incomplete_materials`.
- `sanitize_csv_filename` edge cases; zip de-dupe on duplicate assembly names.
- Layer order is ext→int regardless of stored `orientation`.

## Done when

`uv run pytest` green for the new module; golden SI CSV approved; no route or
frontend changes yet.
