# Window Copy/Paste Tool – Implementation Task List

**Related Plan:** `window-copy-paste.md`
**Status:** Draft
**Created:** 2026-01-17

---

## Phase 0 – Alignment & Scope Lock

- [x] 0.1 Confirm API approach: **Option A** (single endpoint) vs **Option B** (multi-call)
- [x] 0.2 Confirm payload fields: operation + glazing + 4 frame sides
- [x] 0.3 Confirm visual affordances: icon swap + “Paste mode” badge + pulse highlight

---

## Phase 1 – Backend API (Option A preferred)

- [x] 1.1 Add schema for update payload (e.g., `operation`, `glazing_type_id`, `frame_type_ids`)
- [x] 1.2 Add route: `PATCH /aperture/update-element-assignments/{elementId}`
- [x] 1.3 Service: update operation, glazing, and frame sides in a **single transaction**
- [ ] 1.4 Validate permissions (auth required) and element ownership
- [x] 1.5 Return updated aperture for UI refresh
- [x] 1.6 Backend tests for success + failure cases

_Representative snippet (shape only, no full code):_

- Payload shape: `{ operation, glazing_type_id, frame_type_ids: { top, right, bottom, left } }`

---

## Phase 2 – Frontend State & Context

- [x] 2.1 Add Copy/Paste tool state (e.g., `copyBuffer`, `isPasteMode`)
- [x] 2.2 Store snapshot of source element: operation, glazing id, frame ids
- [x] 2.3 Ensure paste mode **persists across aperture changes** in Windows view
- [x] 2.4 Clear selection on copy action
- [x] 2.5 Add `resetPasteMode()` helper (used by Esc + outside clicks)

---

## Phase 3 – Toolbar UI

- [x] 3.1 Add Copy/Paste toolbar button next to existing edit tools
- [x] 3.2 Use eyedropper icon for Copy, fill icon for Paste
- [x] 3.3 Tooltip text updates by state (“Select an element to copy…” / “Click an element to apply…”)
- [x] 3.4 Add subtle badge or label for **Paste mode**
- [x] 3.5 Disable Copy when selection count ≠ 1 or user not authenticated

---

## Phase 4 – Element Interaction

- [x] 4.1 On element click:
  - [x] If **paste mode active** → apply copied assignments to clicked element
  - [x] Else → existing selection behavior
- [x] 4.2 If user clicks **outside any element**, exit paste mode
- [x] 4.3 On `Esc` key press, exit paste mode
- [x] 4.4 Hover highlight on element in paste mode (target preview)
- [x] 4.5 Pulse highlight on successful paste

_Representative snippet (shape only):_

- `onElementClick = isPasteMode ? handlePaste(targetId) : toggleSelection(targetId)`

---

## Phase 5 – Frontend Service Layer

- [x] 5.1 Add `apertureService.updateElementAssignments(...)` (Option A)
- [ ] 5.2 If Option B, orchestrate sequential calls with failure handling
- [x] 5.3 Surface errors to UI; keep paste mode active on failure

---

## Phase 6 – Error Handling & UX Feedback

- [x] 6.1 Disable Copy if source element missing required data
- [x] 6.2 On paste failure: alert + keep paste mode active
- [x] 6.3 If source element deleted: clear buffer + notify user
- [x] 6.4 On paste success: optional toast or subtle confirmation

---

## Phase 7 – QA Checklist

- [ ] 7.1 Copy requires exactly one element
- [ ] 7.2 Paste applies operation + glazing + frames
- [ ] 7.3 Paste mode persists across aperture changes
- [ ] 7.4 Esc exits paste mode
- [ ] 7.5 Clicking outside element exits paste mode
- [ ] 7.6 Inside/Outside view does not affect data mapping
- [ ] 7.7 Error handling keeps paste mode active

---

## Phase 8 – Documentation & Cleanup

- [x] 8.1 Update `window-copy-paste.md` status to “Implemented”
- [x] 8.2 Add short snippet to `context/frontend.md`
- [ ] 8.3 Run formatter/lint if needed

---

_Implementation task list created: 2026-01-17_
