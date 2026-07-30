---
DATE: 2026-07-29
UPDATED: 2026-07-30 — implementation and live Excel verification complete
TIME: 08:25 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 3 — CSV and formula-bearing XLSX serializers, the export
  endpoint with units param and capability gate, canonical IP constants.
  Backend only.
RELATED: ../PRD.md §5/§6.7/§6.8, ../decisions.md §D-2/§D-3/§D-4/§D-8/§D-9,
  ../research.md §2/§4, backend/features/shared/responses.py,
  backend/features/envelope/phpp_export.py,
  backend/features/heat_pumps/phius_export.py
---

# Phase 3 — CSV + formula-XLSX exporters

## Goal

`GET …/apertures/u-values/report/export?format=csv|xlsx&units=IP|SI`
(default **IP**) streams a file a Phius reviewer can audit: the CSV is
flat full-precision values; the XLSX recalculates to *exactly* the app's
stored numbers because its formulas mirror the code — 45° corner split and
`ROUND(u_element, 4)` included.

## Hazards

1. **Exact reproduction or nothing** (D-3). Input cells carry
   full-precision values; formula cells implement PRD §3 verbatim. Any
   cell where "Excel says X, the app says Y" defeats the feature. The
   rounding pin: element U is `ROUND(…, 4)` *before* area-weighting.
2. **Convention parity with the code, not the legacy sheet** (D-2). Corner
   rectangles split 45° between adjacent frames — do not copy the Arverne
   sheet's top/bottom-full-corner formulas (`research.md` §2 table).
3. **Public repo**: golden fixtures are synthetic. Never embed values from
   the Arverne example or any manufacturer data in tests.
4. **Unfinished elements**: blank input cells + literal `UNFINISHED` in
   result cells (no formula) — a blank times a formula silently yields 0
   in Excel, which is exactly the laundering PRD §6.2 forbids.

## Work

1. **Canonical units** — one module (e.g.
   `features/aperture_u_value/units_ip.py`, or promote to
   `features/shared/` if PHPP export wants it later): `M_TO_FT`,
   `MM_TO_IN`, `M2_TO_FT2`, `W_M2K_TO_BTU_HRFT2F = 0.1761101838`,
   `W_MK_TO_BTU_HRFTF` (derived, cited in code). Check
   `phpp_export.py` / `heat_pumps/phius_export.py` first and reuse any
   existing constants rather than adding a third copy (D-9 spirit).
2. **Response helpers** (`features/shared/responses.py`):
   `csv_download_response(text, filename)` — `text/csv; charset=utf-8`,
   `Content-Disposition: attachment`; `xlsx_download_response(data,
   filename)` — `application/vnd.openxmlformats-officedocument.
   spreadsheetml.sheet`.
3. **`report_csv.py`** (pure function, report DTO + units → str): columns
   per PRD §5.2 — identifiers/names, geometry, glazing, 4 edges ×
   {frame name, width, U_f, Ψ-g, Ψ-install, edge length, interior length,
   A_frame, Q_frame, Q_spacer}, element totals, aperture rollups repeated
   per row. UTF-8 **BOM** prefix, `\r\n` terminators, `csv` module
   minimal quoting, unit suffix in every header. Full precision (`repr`-
   grade floats). Unfinished cells empty, plus a trailing `warnings`
   column carrying the human-readable reasons.
4. **`report_xlsx.py`** (pure function, report DTO + units → bytes,
   openpyxl — first write-use in the repo): sheet **"Window Units"** —
   provenance block (project, version label, generation timestamp passed
   in by the route, the fixed convention note from Phase 2, and the D-7
   annotation "aperture U-w includes unfinished elements as U = 0" when
   any exist); header rows with units; per element one row: input cells
   (values) then formula cells referencing them by coordinate —
   interior lengths, per-edge center strip, two half-corner terms
   (`=($W$·adjW)/2` shape), A_frame, Q_frame, Q_spacer, glazing area,
   Q_glazing, `=ROUND((Qg+ΣQf+ΣQψ)/(W*H), 4)` element U, aperture name
   column, `SUMPRODUCT`/`SUMIF` area-weighted U-w and glazing-area-
   weighted SHGC rollup columns. Sheet **"Summary"** — one row per
   aperture: name, area, U-w, SHGC, by formula reference to the detail
   sheet. Ψ-install column present, header suffixed "(excluded from
   U-w)". Number formats sensible (inputs full precision, no display
   rounding that hides data). Freeze panes under the header.
5. **Route** (`routes.py`): `format: Literal["csv","xlsx"]`,
   `units: Literal["SI","IP"] = "IP"`. Reads the **saved version** (D-4;
   `get_saved_document` precedent — no `source` param on the export).
   Gate: add `APERTURE_EXPORT_U_VALUE_REPORT` to
   `features/access/capabilities.py` and `require_capability(access, …)`,
   mirroring `ENVELOPE_EXPORT_PHPP`'s definition *and* grant path
   (follow how the envelope capability reaches editors — same mechanism,
   no new grant machinery).
   Filename: `{bt_number}-aperture-u-values-{units}-{version_label}.{ext}`
   via the existing sanitize/slug helper.
6. **Tests** (`backend/tests/test_aperture_u_value_export.py`):
   - CSV golden file (synthetic fixture, both unit systems); BOM + CRLF
     asserted on bytes;
   - XLSX re-read with openpyxl: formula strings pinned on one full
     element row (all four edges), `ROUND(`/`SUMPRODUCT(` present,
     input cells match report values (converted), unfinished row has
     blank inputs + `UNFINISHED` literals, Summary references resolve;
   - units: spot-check a known SI→IP conversion end-to-end;
   - capability: 403 without the capability, 200 with; format/units
     validation 422s.
   - **Recalc parity is structural here** (openpyxl doesn't evaluate);
     the human recalc check lives in Verification.

## Out of scope

Frontend anything; draft-source exports; preflight endpoint (the report
endpoint already exposes warnings — the frontend dialog reads those).

## Verification

`make check-backend`; goldens green; **manual recalc check**: generate the
XLSX for the AGENT-BROWSER fixture, open in LibreOffice/Excel, force
recalculate, confirm zero result-cell drift vs the app and that element
U's match the builder chip at 4dp. Record the check in STATUS.md.
`make ci` before hand-off.

## Implementation ledger

- Added canonical shared `UnitSystem` plus precise aperture length, area,
  U-value, linear-psi, and heat-flow conversions.
- Added safe shared download responses/filename parts and the
  `APERTURE_EXPORT_U_VALUE_REPORT` member capability.
- Added SI/IP BOM+CRLF CSV goldens and a formula-bearing two-sheet XLSX with
  provenance, full-precision present inputs, `UNFINISHED` calculated cells,
  per-edge 45° split formulas, one aperture-local rollup calculation per
  aperture, and formula-linked summaries.
- Neutralized user-authored spreadsheet-formula prefixes in both formats;
  preserved valid inputs for non-positive glazing geometry; documented the
  shared-mullion convention.
- Focused exporter/access/auth/envelope backend suite: `93 passed`; focused
  frontend conversion tests: `27 passed`; exporter regressions: `8 passed`.
- `make check-backend` and `make ci`: `1741 passed, 7 skipped`; frontend
  `253` files / `2346` tests, structural guards, and production build;
  `graphify update .`: passed.
- An isolated `xlwings` run opened the generated workbook in Microsoft
  Excel. The first recalculation exposed U-w `0` and blank SHGC results
  hidden by blanket `IFERROR`; the rollups were corrected to use
  text-tolerant `SUMPRODUCT` arguments without blanket masking.
- Final Excel recalc: `44` formulas, zero formula errors; Element U
  `0.17367986326355997`, Aperture U-w and Summary U-w
  `0.09472966786602`, SHGC `0.45000000000000007`, one unfinished element.
- Final simplify pass localized rollup ranges to each contiguous aperture
  section, removed cross-aperture O(N²) recalculation, and consolidated
  HTTP header filename sanitization.
