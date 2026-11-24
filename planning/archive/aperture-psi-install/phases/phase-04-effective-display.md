# Phase 04 — Effective-value display (element cards + reports)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Complete 2026-08-04 — implemented on feature/aperture-psi-install;
         `make ci` green; as-built amendments at the end of this file
AUTHOR:  Ed + Claude
SCOPE:   Frontend. The zero-interaction layer: effective Ψ-install visible on
         every element card edge row and flowing through the U-Values report.
RELATED: ../decisions.md (D-6a), ../research.md §5.3, phases 02–03
```

## 1. Frontend mirror helpers

New pure modules beside `aperture-geometry.ts`
(`frontend/src/features/apertures/`):

- `edge-classification.ts` — mirror of the backend classifier
  (perimeter/interior per element side; void-adjacent = perimeter). Share
  test fixtures with the backend suite (copy the case tables verbatim into
  the vitest file and note the pairing in both test files so drift is
  caught by review).
- `install-psi.ts` — mirror of the resolver: slot → type row → value;
  None → `apit_default` row; interior → 0. Inputs come from the phase-02
  slice payload (`aperture_install_types` rows + element `installs` slots).

## 2. FrameRow third cell

`frontend/src/features/apertures/components/FrameRow.tsx:76-78` — replace the
hardcoded `-` cell:

- Effective Ψ-install formatted with the shared conductivity formatter (same
  unit path the U-Values panel uses at `UValueReportPanel.tsx:389`; respect
  IP/SI toggle, no unit suffix in the cell — match the sibling U-value/width
  cells).
- Visual states: **muted** (`inherited` styling token) when
  `source === "default"`; normal weight when `assigned`; text `0 (mull)`
  muted when interior. Tooltip: type name + source ("Default 0.052 W/m·K" /
  "Head @ lintel — calculated").
- `ApertureElementCard.tsx` header row (`:76-86`): label the third metric
  column `Ψ-inst` (it is currently unlabeled/blank — verify and match the
  header pattern of the other columns).
- CSS: tokens only; reuse existing muted/metric classes from
  `apertures.css` — no new off-system styles.

## 3. U-Values report

Backend already emits real `psi_install_w_mk` per edge after phase 02 —
verify `UValueReportPanel.tsx:389` and the XLSX download show resolved values
(assigned + default + 0-mull) on the AGENT-BROWSER fixture, and update the
panel's empty-state copy if it assumed missing values.

## 4. Tests & exit gate

- Vitest: classification + resolver mirrors (paired fixtures), FrameRow
  render states (assigned/default/mull, SI + IP).
- Agent-browser screenshots: element card with mixed states; U-Values panel.
- Closeout gate; STATUS.md ledger with screenshots.

## As-built amendments (2026-08-04)

- **§2 column layout deviates from the plan's premise.** The plan assumed
  the third metric column was "unlabeled/blank"; it was the g-Value
  column (shared with the glazing row). Instead of overloading one header
  with two quantities/units, the element-card table gained a dedicated
  **sixth column** `Ψ-inst [W/(m-K)]` — the glazing and operation rows
  render `-` there, mirroring how the Width column already handles
  glazing rows. `g-Value` keeps its own header.
- **§1 mirrors + provider seam.** `edge-classification.ts` and
  `install-psi.ts` mirror the backend modules (reciprocal "mirrored in
  TypeScript" pointers added to the four backend files so lockstep cuts
  both ways). Install-type summaries flow through an
  `InstallTypesProvider` mounted in AperturesTab (the
  ManufacturerFilter/Drift provider pattern) rather than prop-threading
  through the size-capped canvas container;
  `useInstallPsiResolution(aperture)` owns the per-aperture memo.
- **Display-only mirror, rule check:** the mirror derives display values
  from backend-authored slice data (library psi values + slots); the
  authoritative resolver still backs the U-Values report, route 3, and
  the cache identity. Chosen for zero-latency updates while editing;
  re-affirmed rather than pushing per-side psi into the builder's
  U-value polling payload.
- **Known duplication (pre-existing family):** the psi unit-label string
  now has a 4th copy (`ApertureElementCard.psiInstallUnitLabel`);
  catalogs' `psiUnitLabel` spells `W/m-K` while `lib/units` renders
  `W/(m-K)`. Follow-up candidate: export unit strings from `lib/units`
  beside the formatters.
- **Verified live** on the AGENT-BROWSER fixture (assigned 0.021 /
  inherited 0.04 / `0 (mull)`, muted styling; U-Values report Ψ-INSTALL
  column shows the same three sources per edge). Screenshots:
  `working/agent-browser/frame-row-psi-phase04.png`,
  `working/agent-browser/u-values-psi-phase04.png`.
