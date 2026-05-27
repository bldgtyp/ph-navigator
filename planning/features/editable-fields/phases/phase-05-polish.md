---
DATE: 2026-05-26
TIME: 15:30 ET
STATUS: PHASE PLAN — OPTIONAL. Depends on Phase 3 complete + PRD
        acceptance (`planning/features/editable-fields/PRD.md`).
        Each item ships independently; none are gating.
AUTHOR: Claude (Opus 4.7)
SCOPE: Optional polish items that aren't required for the unified
       field-config model to work. Each is shippable on its own
       schedule. Items include the lossy-conversion completion toast,
       visual treatment of locked attributes, lock-list documentation
       in the modal description tooltip, and the deferred "Duplicate
       record" right-click action (from Plan-30 follow-ups).
RELATED:
  - planning/features/editable-fields/PRD.md (master PRD, §P6 Phase 5)
  - planning/features/editable-fields/archive/complete/plan-30-datatable-identifier-column.md (origin of "Duplicate record" follow-up)
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSection*.tsx
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
---

# Plan 31 — Phase 5 — Polish & Follow-Ups (Optional)

## P0. Phase Intent

Phase 5 is a grab bag of optional polish. **None of these items gate
the rest of the rollout** — Phases 1a / 1b / 2 / 3 / 4 deliver the
functional plan. Phase 5 items ship if and when bandwidth allows;
they're documented here so they don't drift back into ad-hoc tickets.

Each item is independent. Pick any subset; they share no dependencies
on each other.

## P1. Preconditions

- Phase 3 shipped (the modal-level UX is settled enough that polish
  is meaningful).
- Per-item acceptance from Ed before merge (these are subjective
  UX calls).

## P2. Polish items

### P2.1 Lossy-conversion completion toast

**Today:** the modal's TypeChange preflight shows the affected-row
count and the user acks. The conversion completes silently — no
post-completion notification.

**Polish:** show a non-intrusive toast on lossy-conversion completion
("3 values were cleared in iCFA"). Lossless conversions show
nothing. Confirmation-required conversions (the existing flow)
already gate on the ack, so the toast is purely informational.

**Constraints:**
- Toast text comes from a closed copy table (no string templating
  beyond the column display name + the affected-row count).
- Toast is dismissable; auto-dismisses after a sane interval
  (default `5000ms`; respect any project-level toast config).
- No new audit-log entries (the audit is already written by the
  schema-mutation pipeline).

**Success criterion:** a user converts a built-in field from
`single_select` → `number` with two unparseable rows; the conversion
lands; a toast announces "2 values were cleared."

### P2.2 Visual treatment of locked attributes

**Today:** locked sections / inputs render disabled (greyed) with
the uniform "Field Locked" tooltip. There is no positive visual
signal that the section is *intentionally* locked (vs. e.g.
disabled because of an in-flight save).

**Polish:** add a subtle muted lock icon to the modal section
heading when *any* attribute in that section is locked, and a
matching micro-affordance on the header cell (e.g. a small
`--phn-header-border-locked` accent that's already in the design
tokens). The header lock indicator is visible to Viewers as well as
Editors (`context/technical-requirements/data-table.md` already
defines the token).

**Constraints:**
- The icon is decorative; it does not replace the "Field Locked"
  tooltip (which stays on each disabled input).
- No new tooltip per icon — keep the uniform "Field Locked" string.
- Token must not consume a fifth header-tint channel (the data-
  table.md "Layout, Styling, And Accessibility" section already
  reserves four for filter / sort / group / future).

**Success criterion:** locked sections in the modal carry a muted
lock glyph; locked column headers carry the left-border accent.
Visual review with Ed before merge.

### P2.3 Lock-list documentation in the modal's description tooltip

**Today:** the modal has a free-form `description` field per
FieldDef. There's no in-modal explanation of *which* attributes are
locked or *why*.

**Polish:** below the description, render a small expandable note
("This field has the following locked attributes: …") that lists the
lock keys in human-readable form. Uniform copy across all fields —
no per-field "why" text (matches the Q-F5 decision to keep the
tooltip generic).

**Constraints:**
- Reads from `fieldDef.locked`; no new persistence.
- No expandable behavior on mobile (mobile is out of v1 scope per
  PRD §3).
- Doesn't add a per-field override slot (Q-F5).

**Success criterion:** a user opening the modal on a built-in field
sees the lock-list note below the description; clicking the note
expands the list of locks; collapsing returns to the default.

### P2.4 "Duplicate record" right-click context-menu action

**Origin:** Plan-30 P4 deferred this in favor of the truly-blank
Shift-Enter insert. The need stands.

**Polish:** add a right-click context-menu item on a row (not a
cell) that duplicates the row's grid-visible fields into a new row.
The new row gets a fresh row id, all `record_id` value collapsed to
empty (so the new row is a distinct identifier-empty row from the
start), and field defaults applied to the locked-type fields per
the existing `buildEmptyRow` pipeline.

**Constraints:**
- The right-click target is the row chrome (row-number cell or
  drag-handle), not the active cell — keep cell context menus
  separate.
- Duplication is a single `rowInsert` WriteOp (one undo entry).
- `record_id` is intentionally **not** cloned (it would
  immediately trigger the duplicate-warning chip and be a worse
  default than empty). This is the deliberate difference from the
  pre-Plan-30 Shift-Enter behavior.
- Available only to Editors; hidden in Viewer mode.

**Success criterion:** a user right-clicks on a Rooms row, picks
"Duplicate record," a new row appears beneath with every cell
populated from the source row except `record_id` (and except locked-
type plumbing like `id`, which mints fresh).

### P2.5 Header double-click trigger contract polish

**Today:** Phase 1a wired double-click to open the modal. That's
sufficient.

**Polish (deferable):**
- Tighten the discoverability: a hover tooltip on the header label
  ("Double-click to edit field").
- Keyboard-equivalent: `Alt+Enter` on a focused header opens the
  same modal.

**Constraints:**
- The hover tooltip is suppressed on Viewer mode (no edit
  affordances).
- The keyboard shortcut respects the existing accessibility
  contract (focus stays on the header; modal grabs focus on open;
  Escape returns focus to the header).

**Success criterion:** discoverability test with a fresh user; the
header label's editability is obvious without prior instruction.

### P2.6 Conversion-history affordance on a built-in field

**Polish (speculative):** when a built-in field has been retyped at
least once during the project's lifetime, surface a small badge on
the header ("Type changed once" / "Type changed N times") that
opens a mini-history view from the user_action_log. The history
view shows the previous types, who changed them, and when.

**Constraints:**
- Reads from the action log (US-C1); requires the log query
  surface to be queryable per-field. **If the log query surface
  doesn't exist yet, this item is blocked until it does.**
- Doesn't add new audit kinds.
- Editor-only.

**Success criterion:** a project where the user retyped `Number`
from text to number shows the badge; clicking it surfaces the
prior type, the timestamp, and the actor.

## P3. Rules & Constraints (cross-item)

1. **No item is gating.** Phase 5 can ship empty if the polish
   isn't worth the cost.
2. **No new audit-log kinds, no new schema-version bumps, no new
   wire-format changes.** Polish items are render-time / UX-level
   only.
3. **Each item ships behind its own merge.** Don't bundle multiple
   polish items into one PR unless they share code paths.
4. **Each item gets a UX review with Ed before merge.** These are
   subjective calls.

## P4. Workstreams

Per-item; no shared workstream. See P2 for each item's scope.

## P5. Evaluation Method

Per-item; see P2 success criteria.

## P6. Success Criteria (Gating)

There is no gating success criterion for Phase 5 as a whole. Each
item is independently shippable, evaluated, and accepted.

The phase is "closed" when:
- The PRD's optional list (PRD §P6 Phase 5) is reviewed; each item
  is either shipped, deferred indefinitely, or rejected.
- The rejection / deferral is recorded in the relevant context doc
  (so a future agent doesn't re-propose the same polish).

## P7. Risks & Mitigations

- **Risk:** Polish items accumulate scope creep (e.g. P2.6's
  conversion-history affordance grows into a full history viewer).
  - **Mitigation:** each item's success criterion stays narrow.
    Bigger features get their own PRD.
- **Risk:** A polish item interferes with a Phase 3 / 4 in-flight
  change.
  - **Mitigation:** Phase 5 work is gated on Phase 3 being shipped
    and stable. Land polish on a clean baseline.

## P8. Out-Of-Band Considerations

- Phase 5 is a good landing zone for opportunistic improvements
  surfaced during user testing of Phases 1–4. New polish items
  added to this doc as they emerge.

## P9. Follow-Ups Out Of This Phase

- Anything that grows beyond polish (e.g. full schema-mutation
  history viewer, per-field "why locked" explanations from
  feature authors) becomes its own PRD.
