---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — planned, not implemented
AUTHOR: Ed May / Codex
SCOPE: Documentation ordering and anonymous visibility for fully N/A records
RELATED:
  - planning/features/documentation-na-prioritization/PRD.md
  - planning/features/documentation-na-prioritization/STATUS.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/
  - planning/2026-08-19-ui-batch.md
---

# Documentation N/A Prioritization

Within Documentation → Envelope → an expanded Assembly, actionable materials
must remain visually primary. Fully N/A materials currently stay mixed into
their original material order. Logged-in users still need access to them, but
only as one de-emphasized bottom section; anonymous viewers do not need them at
all.

## Read order

1. `PRD.md` — ordering, visibility, filtering, and count contract.
2. `STATUS.md` — next step and verification ledger.

## Current-code anchors

- `frontend/src/features/documentation/components/DocumentationSummaryView.tsx`
  filters records but preserves incoming order in `DocumentationGroupView`.
- `frontend/src/features/documentation/components/DocumentationRecordViews.tsx`
  owns row status presentation.
- `frontend/src/features/documentation/documentation.css` already mutes records
  with `data-spec-status="na"`.
- `frontend/src/features/documentation/lib.ts` owns attention-filter semantics.
- The accepted evidence vocabulary remains: Spec
  `Complete/Question/Needed/NA`; Datasheet/Photo `Complete/Needed/NA`.

Do not infer anonymous state from `canEdit`: locked editors and authenticated
read-only users are still logged in. The implementation must use the app's
actual session/auth state.

This packet changes Envelope Assembly-material presentation and raw-axis
attention matching only. Other Documentation sections, stored order, rollups,
attachment rules, and draft writes remain unchanged.
