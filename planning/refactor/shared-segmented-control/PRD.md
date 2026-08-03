---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred — scoped, not started
AUTHOR: Claude with Ed May
SCOPE: Contract for a shared `SegmentedControl` primitive and the migration of
  the five existing implementations onto it.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ../../../context/DESIGN_SYSTEM.md
---

# PRD — Shared segmented control

## The problem in one line

Five implementations of "pick one of N, inline, mutually exclusive" exist on
the same token set, and the design system names none of them.

## What varies today (and what must survive)

| Axis | #1 topbar | #2 modal units | #3 pill-tab | #4 drift-choice |
|---|---|---|---|---|
| Track | Accent-tinted pill, `padding: 3px` | Accent-tinted pill, `--space-2` | No track; free-standing pills, `gap: --space-6` | Accent-tinted pill, `--space-2` |
| Active mark | Sliding `::before`, 32px | Sliding `::before`, 26px | Per-pill accent fill | Per-option accent fill |
| Cell width | Fixed square | Fixed square | Content | Content |
| Option count | 2 | 2 | N | 3 |
| Markup | `<button role="radio">` | `<button role="radio">` | `<button>` | `<label><input type="radio">` |
| A11y | `role="radiogroup"` + `aria-checked` | same | `role="tablist"`/`"group"` + `aria-selected`/`aria-pressed` | `role="radiogroup"` + real radios |
| Type scale | `--fs-2xs` mono caps | `--fs-2xs` mono caps | `--fs-md` sentence case | `--fs-2xs` mono caps |

Two genuinely different things are hiding in this table:

- **A compact chrome toggle** (#1, #2, #4) — mono caps, pill track, filled
  active option. Same visual family already.
- **A content-scale pill tab** (#3) — larger sentence-case text, no track,
  used for switching page/dialog sections.

The primitive should serve the first cleanly and *may* absorb the second
behind a `size`/`variant` prop — see Q1.

A fifth implementation, the Edit/Preview switch in `StatusItemModal`, was
found during the phase-1 reuse review. It is a content-scale single-select and
belongs in the shared primitive after the compact chrome consumers migrate.

## Proposed API

```tsx
<SegmentedControl
  value={choice}
  onChange={setChoice}
  ariaLabel="Value to keep"
  options={[
    { value: "keep_mine", label: "Keep mine" },
    { value: "take_catalog", label: "Take catalog" },
    { value: "use_value", label: "Edit…" },
  ]}
  size="sm"          // sm = chrome toggle (default) | md = content pill tab
  equalWidth         // opt-in: enables the sliding indicator
/>
```

Requirements:

1. **Generic over the value type** — `SegmentedControl<T extends string>`, so
   `UnitSystem` and `ProjectMaterialRefreshChoice["action"]` both type-check
   without casts.
2. **One a11y story.** `role="radiogroup"` with real named radio inputs. Native
   radios provide arrow-key selection and roving focus without a second
   JavaScript interaction model.
3. **Filled active cells, no sliding pseudo-element.** This preserves the
   selected-state appearance while removing a duplicated animation and the
   two-equal-cell assumption.
4. **Disabled state** — `#3` consumers use `:disabled`; the primitive must
   support per-option and whole-control disabled.
5. **Zero feature CSS.** The class lives in `shared/ui/`; features pick the
   role, never restyle it.

## Migration order

Ordered so each step is independently shippable and verifiable:

1. **Build + adopt in one new place.** Land `SegmentedControl` and migrate
   `.drift-choice` (#4) onto it. Smallest blast radius, one consumer, already
   has a browser-verified reference screenshot to diff against.
2. **`ModalUnitToggle` (#2).** Same visual family, one component, several
   dialogs. Delete `.modal-unit-toggle`.
3. **`TopbarUnitToggle` (#1).** App chrome — visible on every page, so verify
   with the rendered-typography sweep (`make typography-eval`) as well as
   screenshots.
4. **Content-scale single-selects.** Migrate the `role="group"` `.pill-tab`
   consumers and the project-status Edit/Preview switch. Keep true
   `role="tablist"` controls as tabs.
5. **Design system.** Add `SegmentedControl` to the component inventory table
   in `context/DESIGN_SYSTEM.md` and the ownership table in
   `frontend/src/styles/README.md`. Until this step lands, the refactor has not
   actually prevented a sixth implementation.

## Open questions

- **Q1.** Does `.pill-tab` belong to this primitive? It is content-scale and
  some usages are true tabs (`role="tablist"` in `CondensationRiskModal`).
  Absorbing tabs into a radiogroup primitive would be an a11y regression;
  absorbing only the `role="group"` single-select usages
  (`CondensationWherePanel`, `SegmentMaterialPicker`) may be right.
- **Q2.** Does the sliding indicator survive at all? It exists in #1 and #2
  only. If the filled-cell treatment reads as well, dropping it removes the
  equal-width constraint entirely and simplifies the primitive.
- **Q3.** Where does the CSS live — `shared/ui/SegmentedControl.css` (co-located
  like `StatusSelect.css`) or `styles/base.css`? Follow whatever
  `frontend/src/styles/README.md` says owns shared component CSS.

## Decisions — 2026-08-03

- **Q1:** absorb content-scale single-select groups, but not true tabs. A
  radiogroup primitive must not replace `role="tablist"` semantics.
- **Q2:** remove the sliding pseudo-element. The shared primitive fills the
  selected cell for both fixed- and variable-width options.
- **Q3:** co-locate the CSS at `shared/ui/SegmentedControl.css` and load it once
  through `App.css`, matching the styling guide's shared-component rule.

## Done means

- One segmented-control implementation. `git grep` for `unit-toggle`,
  `drift-choice`, and the project-status `.segmented-control` returns nothing;
  `.pill-tab` remains only on true tablist consumers.
- `SegmentedControl` is in the design-system component inventory.
- `make ci` green, including `check:typography` and the rendered sweep.
- Screenshots of the topbar toggle, a modal unit toggle, and the drift dialog
  before/after, showing no unintended visual change.
