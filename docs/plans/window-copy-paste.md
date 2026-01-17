# Window Copy/Paste Tool (Frames + Glazing)

**Status:** Implemented
**Created:** 2026-01-17

## Goal

Allow users to copy **frame**, **glazing**, and **operation** assignments from one window element and paste them onto other elements with a simple, explicit UI flow.

## Non‑Goals

- No database schema changes.
- Not a general OS clipboard feature (internal, view‑only tool).
- Does **not** copy element size, position, or row/column sizing.

## Why

Manually selecting frame and glazing types for each element is repetitive. A guided copy/paste flow reduces time and errors while maintaining clear user intent.

## UX Summary

- Add a **Copy** button (eyedropper icon) to the Unit Builder toolbar.
- When a source element is selected, clicking **Copy** stores its frame + glazing + operation assignments.
- Copy action **clears any existing selection** and enters Paste mode.
- The button **changes to Paste mode** (fill icon + label or subtle “Paste mode” badge).
- While in paste mode, clicking a target element applies the copied assignments.
- User can paste to multiple elements, **one at a time**, until they **exit** paste mode.
- Exit paste mode via **toolbar toggle** or **Esc**.

## States & Behavior

### 1) Idle

- Toolbar shows **Copy** (eyedropper).
- Disabled unless **exactly one element** is selected.
- Tooltip: “Select an element to copy assignments.”

### 2) Copied

- After copying, UI enters **Paste mode**.
- Toolbar shows **Paste** (fill icon), with a subtle badge: “Paste mode”.
- Tooltip: “Click an element to apply assignments. Click again to exit.”
- Hover and highlight window-elements to show the target window-element during mouse events.
- Selection is cleared immediately after copy.

### 3) Pasting

- Clicking any element applies frame + glazing + operation to that element.
- If update fails, show a clear error toast/alert and **remain in Paste mode**.
- If update succeeds, show a brief highlight pulse on the target window-element.

### 4) Exit Paste Mode

- Clicking the Paste button again exits Paste mode (clears copied payload).
- ESC key exits Paste mode.
- Clicking anything **other than a window element** exits Paste mode.
- Switching to a new window unit (aperture) **retains** paste mode (explicit decision).

## Interaction Rules

- Copy requires **single selection**.
- Copy clears any existing selection state.
- Paste targets are selected by **clicking elements** in the SVG.
- Paste should **not** be gated by adjacency selection rules.
- Clicking outside a window element **cancels paste mode**.

## Error Handling

- If source element has missing data, disable Copy with explanation.
- On paste failure, show alert and keep paste mode active.
- If the source element was deleted or aperture changed, paste mode is cleared and user is informed.

## Data & API Strategy

### Option A (Preferred): Single backend endpoint

- POST/PATCH: `aperture/update-element-assignments/{elementId}`
- Payload: `{ operation, glazing_type_id, frame_type_ids: { top, right, bottom, left } }`
- Server updates all assignments in one transaction, returns updated aperture.

### Option B (No new endpoint)

- Frontend calls existing endpoints in sequence:
  - update operation
  - update glazing
  - update each frame side
- Pros: no backend work
- Cons: 5+ network calls per paste, partial update risk if a call fails

## Storage / Persistence

- Copy buffer is **UI‑state only**.
- Paste mode **persists across active window (aperture) changes** in the Windows view.
- Reset on page reload or full route change.

## Accessibility & Feedback

- Tooltip text on copy/paste icon
- Visual state (icon swap + label) to avoid ambiguity
- Provide focus indication on the active paste tool

## Edge Cases

- User copies element A, then changes glazing/frame types of A before pasting → paste uses **copied snapshot**.
- User enters paste mode then navigates to different window unit → paste mode stays active.
- User not authenticated → copy/paste disabled (consistent with other edit tools).
- Inside/Outside view flip does **not** change data mapping; paste uses actual element IDs.

## Open Questions

- None (all decisions captured).

---

_This plan defines behavior + constraints only. Implementation task list to follow after approval._
