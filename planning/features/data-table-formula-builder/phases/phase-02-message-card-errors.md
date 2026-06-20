---
DATE: 2026-06-20
TIME: 08:05 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Formula preview/error card treatment and improved local error copy.
RELATED:
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/PLAN.md
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx
  - frontend/src/shared/ui/data-table/lib/formula/localState.ts
  - frontend/src/shared/ui/data-table/lib/formula/errors.ts
  - backend/features/project_document/mutations/formula_ops.py
---

# Phase 02 - Message Card And Errors

## Objective

Make formula preview and error messages visually explicit, accessible, and
actionable. Fix the current run-together text problem by turning formula
feedback into a structured card.

This phase should still avoid formula grammar changes.

## Entry Conditions

- Phase 01 is implemented or intentionally skipped with recorded rationale.
- Existing create/edit formula flows still pass focused tests.

## Implementation Files

Primary files:

- `frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx`
- `frontend/src/shared/ui/data-table/lib/formula/localState.ts`
- `frontend/src/shared/ui/data-table/DataTable.css`

Possible supporting file:

- `frontend/src/shared/ui/data-table/lib/formula/userMessages.ts`

Read-only parity/reference:

- `backend/features/project_document/mutations/formula_ops.py`
- `frontend/src/shared/ui/data-table/lib/schemaMutationErrors.ts`
- `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`

## Design Contract

- Preview label, status, and body are separate elements. They must never render
  as adjacent inline text.
- Blocking local formula errors should use an alert treatment.
- Non-blocking preview states should remain polite status updates.
- Error copy should name the thing the user can fix.
- Backend errors remain authoritative. Frontend messages can improve clarity,
  but backend mutation rejection still controls final save.

## Work Plan

1. Refactor preview content shape.
   - Replace the current `PreviewPanel` `{ modifier, body }` with a richer
     shape:
     - `tone`: `neutral | success | warning | error`;
     - `title`;
     - `body`;
     - optional `detail`;
     - `blocking`.
   - Render a single card component from that shape.

2. Separate accessible roles.
   - Use `role="alert"` for dirty parse/missing-ref/resource/cycle states that
     disable Save.
   - Use `role="status"` with `aria-live="polite"` for normal preview states.
   - Keep `aria-describedby` on the source editor pointed at the card.

3. Improve local error formatting.
   - Preserve the current structured `LocalFormulaState`.
   - Add user-facing helpers for common parser messages:
     - `unexpected token '{Number}'` after another atom -> likely missing
       operator; suggest `&`, arithmetic operator, or comma if inside a
       function.
     - `unterminated field reference` -> tell user to close with `}`.
     - `unterminated string literal` -> tell user to close with `"`.
     - `empty field reference {}` -> tell user to insert a field name.
     - `unsupported_function` -> show supported functions from
       `ALLOWED_FUNCTIONS`.
     - `missing_ref` -> quote the missing display name and mention this table.
   - Keep raw parser offset available as detail, not the only message.

4. Align backend-submit errors.
   - Review how `dispatchAddField` and `dispatchBundle` failures surface inline.
   - If formula-specific backend errors currently land in generic alert
     paragraphs, style them consistently with the formula card when the formula
     section is active.
   - Do not duplicate backend parsing in the submit path.

5. Add CSS.
   - Formula message card with visible outline.
   - Error tone should stand out from normal modal text.
   - Keep copy readable; no oversized hero-style text in the compact modal.

6. Add tests.
   - Parse error renders a card with separate title/body.
   - Missing field renders quoted field name.
   - Unsupported function lists allowed alternatives.
   - Preview label and body do not concatenate.
   - Save remains disabled for blocking local errors.

## Acceptance Criteria

- The screenshot symptom `Preview based on row at modal openCouldn't parse...`
  cannot recur.
- Formula errors render in a bordered alert card.
- Error copy gives a likely corrective action for common parse mistakes.
- Normal preview still updates for the focused row.
- Save gating remains tied to structured formula validity.

## Verification

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
make frontend-dev-check
```

Optional browser check:

- open a Formula field;
- enter `({Display Name} - {Number}){Number}`;
- verify the error card is visually distinct and actionable;
- enter a valid formula and confirm preview switches back to neutral/success.

## Risks And Watchpoints

- Avoid hiding useful backend details. The local card can simplify wording, but
  diagnostics like offset/source are still useful in details.
- Error text should not promise support for `&` until Phase 03 is complete.
  Before Phase 03 lands, phrase suggestions carefully or gate the message.
- If backend errors are mapped globally, avoid creating a formula-only branch
  that bypasses existing stale-fingerprint and duplicate-name handling.

## Handoff Notes

The desired outcome is a better communication layer, not a more permissive
parser. Keep save validity exactly as strict as before unless Phase 03 has
already landed.
