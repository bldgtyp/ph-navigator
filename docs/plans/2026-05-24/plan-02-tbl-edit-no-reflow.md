---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Second in the 9-plan AirTable-parity polish series.
        Sequenced 2/9 (CSS-only layout fix).
SCOPE: Stop the inline editor from changing its host cell's column
       width or row height when it mounts. Match AirTable: the
       editor renders inside the existing cell box and truncates
       overflow rather than reflowing the table.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-EDIT-1)
RELATED:
  - frontend/src/shared/ui/data-table/components/InlineCellEditor.tsx
    (42-line component; the `<input>` is the entire editor)
  - frontend/src/App.css (the `.data-table-cell-editor` rule)
  - context/UI_UX.md §1.7 (table interaction model)
---

# Plan 02 — Inline editor preserves column layout

## 1. Why this plan exists

When the user double-clicks a text or number cell, the
`InlineCellEditor` renders an `<input>` into the cell. Today, the
input's intrinsic size (set by the browser default — about
`size="20"` chars) does not match the parent `<td>`'s computed
width, so the table reflows: the host column briefly widens, sibling
columns shift, neighboring rows move. The bounce is small but
visually jarring and undermines the "this is one stable grid" mental
model — exactly the regression Ed flagged 2026-05-24 (image #1).

AirTable handles this with a hard rule: the editor's geometry is
**clamped to the cell**. Text that doesn't fit truncates inside the
editor (the user can still scroll horizontally inside the input
because it's still an `<input>`). Columns and rows never move.

Pure CSS fix. No behavior change. One acceptance test pins the
column width invariant.

## 2. Binding constraints

1. **Library-only + CSS only.** No prop changes. No new state. No
   new hook. The only edits are to `InlineCellEditor.tsx`'s
   `className` and the corresponding CSS rule.
2. **The editor must remain a real `<input>`** so keyboard handling
   (Enter, Tab, Escape, arrow keys), text caret, IME, and clipboard
   integration continue to work unchanged.
3. **The fix applies to text + number fields** (the only field types
   `InlineCellEditor` currently serves). Single-select uses
   `SingleSelectPopover`, not `InlineCellEditor`; long-text /
   rich-text don't exist yet — out of scope.
4. **No reflow of sibling cells** is the success criterion. The
   editor may overflow visually (text scrolls inside the input;
   that's expected) but its bounding box stays equal to the cell's.

## 3. Acceptance criteria

1. **Column width is constant across edit start.** With a column
   currently sized to width W, double-clicking any cell in that
   column to start editing leaves the column at width W. Measured
   via `td.offsetWidth` before and after edit-start: difference
   must be 0.
2. **Row height is constant across edit start.** Same invariant on
   `tr.offsetHeight`.
3. **Neighbor cell left edges don't shift.** Measured via the
   `getBoundingClientRect().left` of the cells immediately to the
   right and left of the edited cell — same before vs. after.
4. **Editor visually occupies the cell.** The input fills the cell
   completely (no white margin around it; AirTable parity).
5. **Long text scrolls inside the input.** A 200-char string in a
   100 px-wide column shows the caret moving as the user types past
   the cell edge; the column does not widen.
6. **Editor's focus ring is the cell's outline.** The browser-default
   blue focus ring on the input is suppressed in favor of the
   existing `.data-table-cell-active` outline — same visual idiom
   already used.
7. **All existing inline-edit behavior preserved.** Enter commits,
   Tab moves, Escape cancels, blur cancels (or commits — preserve
   current behavior). No keyboard regression.
8. **No regressions** in existing `useGridEdit` / `InlineCellEditor`
   unit tests.

## 4. Target architecture

### 4.1 CSS changes (the entire fix)

In `frontend/src/App.css`, the `.data-table-cell-editor` rule
should be:

```css
.data-table-cell-editor {
  position: absolute;
  inset: 0;                 /* pin to cell box: top:0; right:0; bottom:0; left:0 */
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 var(--data-table-cell-padding-x, 8px);
  border: 0;
  outline: 0;               /* the cell's outline is the focus ring */
  background: var(--background, white);
  font: inherit;
  color: inherit;
  min-width: 0;             /* override any `<input>` intrinsic min */
}
```

The two critical changes vs. today:

- **`position: absolute; inset: 0`** pins the input to the cell's
  full bounding box regardless of its intrinsic content size.
- **`min-width: 0`** suppresses the browser-default `<input>`
  minimum width that today is what causes the reflow.

Two prereqs for the cell:

```css
td.data-table-cell-editing {
  position: relative;       /* so absolute child is anchored here */
  overflow: hidden;         /* so the input's text doesn't bleed */
}
```

### 4.2 Component changes

In `InlineCellEditor.tsx`, add a wrapper className or rely on the
parent `<td>` to carry `data-table-cell-editing`. The simpler path:
`GridBody.tsx` already sets a per-cell class when editing is active;
extend it with `data-table-cell-editing` (or reuse the existing
class — confirm during Step 1 by reading `GridBody.tsx`'s cell-
rendering switch).

No prop changes to `InlineCellEditor.tsx` itself. Its `<input>`
already carries `className="data-table-cell-editor"`; the fix is
entirely in CSS.

### 4.3 Test plan

- **Unit:** extend the existing `InlineCellEditor.test.tsx` (if
  present) with a render snapshot check, OR a small DOM
  assertion that the input's `getBoundingClientRect()` matches its
  parent `<td>`'s. Library tests run in JSDOM which doesn't compute
  real CSS layout, so this won't catch the visual bug; the proof is
  the Playwright check in Step 3.
- **Playwright MCP:** the demo script (§10) is the real verification.

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Read current rendering path

- Read `GridBody.tsx` to find where editing cells are rendered. Note
  the className applied to the editing `<td>` (likely
  `data-table-cell-active` or similar).
- Read the current `.data-table-cell-editor` rule in `App.css`.
- Confirm where `position: relative` would need to land on the cell.

### Step 2 — CSS + tiny markup change

- Edit `App.css`: update `.data-table-cell-editor` per §4.1; add
  `td.data-table-cell-editing { position: relative; overflow:
  hidden; }`.
- Edit `GridBody.tsx` to add `data-table-cell-editing` to the cell
  className when the cell is the active editor.
- `pnpm test --filter data-table` — all existing tests still green.
- Commit: `fix(data-table): pin inline editor to cell box, no reflow`.

### Step 3 — Playwright visual check

- `make dev`, open Rooms.
- Pre-measure: take a Playwright screenshot of a row.
- Double-click a `name` cell. Take another screenshot.
- Compare: every column edge in the same horizontal pixel position
  in both screenshots.
- Type a 200-char string into the cell. Take another screenshot.
- Compare: column edge still in the same pixel position.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `position: absolute; inset: 0` on the input requires the cell to be `position: relative`. If any cascading CSS overrides this, the input pins to the wrong ancestor. | The new rule scopes `position: relative` to cells carrying the editing class only. The selector is specific enough to win over default `<td>` behavior; confirmed in Step 3. |
| `min-width: 0` on the input is necessary but counter-intuitive (most CSS resets don't set it). | Documented inline in the CSS rule with a one-line comment. Pinned in the acceptance criteria so it can't silently regress. |
| `overflow: hidden` on the cell may clip the text caret when the input scrolls horizontally. | Modern browsers (Chrome, Safari) render the caret inside the input's own scroll context, not the cell's, so the caret remains visible. Verified in Step 3 demo. |
| `background: var(--background, white)` on the input might not match the cell's actual background (e.g. a tinted group row). | The input's job is to cover the cell while editing — the background should be neutral. If a future tint surface (group accent) wants visible bleed-through, can switch to `background: transparent`. Not a concern for the current set of tints. |
| Snapshot tests fail because the editor's bounding box changes. | The fix is the point of the test; update snapshots inline with the commit. |

## 7. What this plan explicitly does not do

- Does not change the editor's keyboard handling.
- Does not change blur / commit / cancel semantics.
- Does not introduce a long-text or rich-text editor variant. (That
  belongs in a future story; when it lands, it can render an
  expanded popover *above* the cell while keeping the cell's
  bounding box unchanged — same invariant.)
- Does not change single-select editing (uses a different editor).
- Does not change the active-cell outline or focus ring color.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — read current path                | 0.1 | 0.3 |
| 2 — CSS + markup change              | 0.3 | 0.5 |
| 3 — Playwright visual check          | 0.3 | 0.5 |
| **Total**                            | **0.7** | **1.3** |

Well under one workday.

## 9. Commit plan

1. `fix(data-table): pin inline editor to cell box, no reflow`

(Step 1 has no commit; Step 3 has no commit unless a follow-up is
needed.)

## 10. Demo script

1. `make dev`, open Rooms.
2. Resize the browser so columns are visibly fixed-width.
3. Take a Playwright screenshot at zoom 100%.
4. Double-click a `name` cell. Type nothing. Take another
   screenshot. Compare: every column edge identical.
5. Type a long string ("Lorem ipsum dolor sit amet…" ~200 chars).
   Take a third screenshot. Compare: column edge unchanged; text
   inside the input scrolls horizontally.
6. Press Enter to commit. Verify the saved value renders truncated
   with ellipsis (existing behavior).
7. Press Escape on an open editor — cell returns to read mode; no
   geometry change.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — read current path                | | | |
| 2 — CSS + markup change              | | | |
| 3 — Playwright visual check          | | | |
| Plan 02 overall                      | | | |
