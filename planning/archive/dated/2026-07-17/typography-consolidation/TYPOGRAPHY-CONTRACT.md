---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: ✅ Active since Phase 1 (2026-07-17); canonical copies live in frontend/src/styles/README.md + context/UI_UX.md — this file is the planning-packet record
AUTHOR: Codex
SCOPE: Authoring, ownership, exception, and enforcement rules for typography
RELATED:
  - `PRD.md`
  - `phases/phase-01-contract-and-ratchet.md`
  - `frontend/src/styles/README.md`
  - `context/UI_UX.md`
---

# Typography contract

This document is the implementation contract for the refactor. During Phase 1,
its accepted rules are copied into the canonical styling guide at
`frontend/src/styles/README.md` and summarized in `context/UI_UX.md`. Do not
leave the final rules only in this planning packet.

## Ownership model

1. `frontend/src/styles/tokens.css` owns the allowed typography values.
2. Shared element classes own role composition: headings, buttons, tabs,
   menus, badges, form controls, modal chrome, and table chrome.
3. Feature CSS may choose an approved role for feature-specific text. It may
   not restyle a shared primitive's typography.
4. Component-local selectors own layout, color, and state styling; typography
   moves to the nearest reusable shared owner when two or more surfaces need
   the same role.
5. A role name describes purpose (`action`, `compact chrome`, `table header`),
   not location (`modal text`, `aperture button`).

## Authoring rules

1. Use only `var(--font-*)`, `var(--fs-*)`, `var(--fw-*)`, `var(--lh-*)`, and
   `var(--tracking-*)` values for the corresponding CSS properties outside
   token-definition files.
2. `inherit` is allowed where the parent deliberately owns the complete role.
   Add a comment when that ownership is not obvious.
3. Do not use `em`, `rem`, `px`, `calc()`, or `clamp()` directly for
   `font-size` in component CSS. This prevents the em-of-em compounding found
   in the audit. Named semantic exception tokens may themselves contain these
   values in `tokens.css`.
4. Do not use numeric `font-weight` values in component CSS.
5. Uppercase UI text uses `text-transform: uppercase` plus
   `var(--tracking-caps)`. Non-uppercase text uses
   `var(--tracking-normal)` or inherits normal tracking.
6. Use a line-height role token. Do not introduce a new literal line height.
   Icon-only and drawing-annotation exceptions must be named tokens.
7. Raw font families and fallback stacks live only in brand/token files.
   Component CSS uses `--font-primary`, `--font-table`, or `--font-mono`.
8. `font:` shorthand is prohibited except `font: inherit`; shorthand hides
   family, size, weight, and line-height from focused review.
9. Do not add typography through React inline `style`, library presentation
   props such as `fontSize`, or generated SVG attributes. Route unavoidable
   chart/canvas adapters through named tokens and the exception registry.
10. Reuse the existing shared class/component before adding a new typography
    selector. A new role requires a PRD/guide update and a guard fixture.

## Token structure

Phase 1 should establish these groups in `tokens.css`:

- Family: existing `--font-primary`, `--font-table`, `--font-mono`.
- Size scale: existing `--fs-2xs` through `--fs-3xl`, plus named semantic
  exception tokens only when an existing scale step cannot express the role.
- Weight: `--fw-regular`, `--fw-medium`, `--fw-semibold`, `--fw-bold`.
- Tracking: `--tracking-normal`, `--tracking-caps`.
- Line height: `--lh-solid`, `--lh-tight`, `--lh-heading`, `--lh-ui`,
  `--lh-body`. Final values are approved from the rendered inventory in
  Phase 1; do not guess them while migrating selectors.

The 13px table body stays as `--data-table-font-size`. The sign-in display
heading and canvas annotation size, if retained, become named semantic tokens
rather than source-lint allowlist literals.

## Role contract

`PRD.md` owns the role table. Implementation follows these composition rules:

- Shared buttons expose action, compact-chrome, text, and icon-only tiers.
- Shared headings expose page/section, display/empty-state, and editor-hero
  roles. HTML heading level remains semantic and is not used as a visual API.
- Shared modal components reuse heading, body, label, control, and action
  roles; they do not own a private type scale.
- DataTable and ReportTable own their dense data roles. Feature tables do not
  override those roles.
- Technical drawing labels use the canvas-annotation role, not ordinary body
  or badge roles.

## Exception policy

An exception is allowed only when a normal role cannot cross a technical
boundary, such as a third-party chart prop or SVG canvas annotation. Every
exception entry must include:

- stable ID;
- owning file and selector/adapter;
- property and approved token;
- why the shared role cannot be used;
- rendered state that verifies it;
- owner and review trigger.

Exceptions may reference tokens; they may not authorize arbitrary literals.
The guard rejects unused, duplicate, and unknown exception entries.

## Enforcement layers

### Static source guard — blocking on every PR

`check:typography` scans CSS plus TS/TSX typography entry points. It uses a CSS
parser, not line regexes, so comments, multiline declarations, shorthands, and
nested functions are handled consistently. Phase 1 begins with a checked-in
debt baseline of normalized `file + selector + property + value` fingerprints.

- New fingerprint: fail.
- Changed/moved fingerprint: fail and review it as new work.
- Removed fingerprint still in baseline: fail until the baseline is reduced.
- Approved token/exception: pass.
- `--update-baseline`: explicit maintainer action, never invoked by CI.

### Rendered contract evaluation

The computed-style sweep validates what source lint cannot: role selection and
cascade output. It must fail for missing states and assert:

- only approved families, mapped token sizes, weights, tracking, and role
  exceptions render;
- role-specific variant budgets from the PRD;
- modal roles reuse non-modal roles;
- the state manifest is complete;
- the total variant ceiling does not regress.

### Human visual review

Screenshots cover hierarchy, wrapping, clipping, table density, button width,
and vertical alignment. Screenshot diffs support review but do not replace the
computed contract.

## Change checklist

Before merging typography-affecting work:

1. Identify the semantic role and reuse its shared owner.
2. Run `pnpm run check:typography` while iterating.
3. Run `make frontend-dev-check`.
4. If rendered typography changes, run the focused audit states plus the final
   full sweep/evaluator before phase closeout.
5. Inspect the required screenshots at 1280x900 and the responsive viewport.
6. Run `make format` and `make ci` before reporting the phase complete.
