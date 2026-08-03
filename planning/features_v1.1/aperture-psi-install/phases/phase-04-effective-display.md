# Phase 04 — Effective-value display (element cards + reports)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started
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
