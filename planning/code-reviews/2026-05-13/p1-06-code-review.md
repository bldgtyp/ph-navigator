---
DATE: 2026-05-13
TIME: 16:00 EDT
STATUS: Code review of P1-06 first-pass deliverable (local complete; staging pending)
SCOPE: Status tab full MVP. Reviews un-committed changes representing
       the P1-06 phase against the roadmap, US-Status, UI/UX §2.5, and
       the data-model decisions for `project_status_items`. Does not
       review against final-app completeness; the `⋯` row-action menu,
       click-to-edit-inline title, and `aria-grabbed`/drop-indicator
       polish remain out of scope per the deliberately small P1-06 cut
       documented in the gap matrix (G-09).
REVIEWER: Claude (Opus 4.7)
RELATED:
  - planning/ROADMAP.html (P1-06 row + ledger)
  - planning/archive/dated/2026-05-13/phase-1-full-buildout-plan.md (P1-06 slice)
  - planning/archive/dated/2026-05-13/phase-1-baseline-gap-matrix.md (G-09)
  - planning/code-reviews/2026-05-13/p1-05-code-review.md (preceding slice)
  - context/user-stories/00-foundation-shell.md (US-Status, criteria
    1-15)
  - context/UI_UX.md §2.5 (Status tab)
  - context/technical-requirements/data-model.md (`project_status_items`)
---

# Code Review — P1-06 Status Tab Full MVP (first pass)

## Scope Check

P1-06's stated scope from the roadmap (lines 177-188):

> Move Status from tracer feature to complete Phase 1 workflow.
> Includes: Empty state; populated vertical timeline; current-step
> visual; add/edit/delete/state/date/description behavior; Markdown
> decision; reorder decision; public Viewer rendering; MCP-readable
> status posture.

Pre-existing from TB-03 / TB-04b (out of P1-06's net diff):

- `project_status_items` schema, REST CRUD, default-template service,
  state-to-completion-date rule (`backend/features/project_status/*`).
- Empty state with three CTAs, vertical timeline, state-cycle button,
  current-step visual computed from first `todo`, completion-date
  pill, explicit up/down reorder buttons, Alt+↑/Alt+↓ keyboard
  reorder, click-to-edit via modal, public Viewer read-only timeline.
- MCP `list_status_items` read tool (TB-04b) over the same REST
  service.

This review only evaluates the *new* P1-06 work and the residual
US-Status gap between the implementation and the documented
acceptance criteria.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `frontend/package.json` | Modified | Adds `react-markdown@^10.1.0` and `rehype-sanitize@^6.0.0` as runtime deps. |
| `frontend/package-lock.json` | Modified | Lockfile resolves the new dep tree (unified/remark/rehype subtree). |
| `frontend/src/App.css` | Modified | `.status-rail` flips to column with gap; `.drag-handle` (mono `::`, grab cursor); `.status-description p / code` paragraph + inline-code styles; `.field-group` / `.field-label-row` / `.segmented-control` / `.markdown-preview` / `.empty-preview` for the new edit-modal preview; `.confirm-dialog-body` for the new delete dialog. |
| `frontend/src/features/project_status/components/StatusDescription.tsx` | Modified | Replaces the regex-based external-link parser with `react-markdown` + `rehype-sanitize`; allow-list is `p, br, strong, em, code, a (http/https)`; `<a>` rewritten through a custom component that re-asserts the `http(s)://` regex and adds `target="_blank" rel="noopener noreferrer"`. |
| `frontend/src/features/project_status/components/StatusItemModal.tsx` | Modified | Adds an Edit/Preview segmented control around the description textarea; preview rebuilds the sanitized renderer. |
| `frontend/src/features/project_status/components/StatusItemRow.tsx` | Modified | Adds HTML5 drag source (`draggable={isEditor}`) with `dataTransfer.setData("text/plain", item.id)`, `dragover`/`drop` handlers that compute before/after by `clientY` midpoint, and a visual `::` drag handle in the rail. |
| `frontend/src/features/project_status/components/StatusDeleteDialog.tsx` | **New** | Replaces `window.confirm()` with a `ModalDialog`-based confirm body wired to the delete mutation's pending state. |
| `frontend/src/features/project_status/routes/StatusTab.tsx` | Modified | Tracks `deletingItem` + `draggingItemId` state; switches delete onClick to open the dialog; adds `dropItem(target, placement)` handler driven by `orderIndexForDrop`. |
| `frontend/src/features/project_status/lib.ts` | Modified | Adds `orderIndexForDrop(items, draggedItemId, targetItemId, placement)`. |
| `frontend/src/features/project_status/lib.test.ts` | Modified | Adds one block with four assertions for `orderIndexForDrop` (after-drop midpoint, before-drop midpoint, self-drop null, missing-id null). |
| `frontend/tests/e2e/health.spec.ts` | Modified | The dialog-accept hook is gone; the test now clicks the row's `Delete` then the modal's `Delete item`. |
| `planning/ROADMAP.html` | Modified | P1-06 row: `[~] Local implementation/browser check complete; staging check pending`; ledger row added; P1-05 flipped to `Complete` per the previous slice's sign-off. |
| `planning/archive/dated/2026-05-13/phase-1-baseline-gap-matrix.md` | Modified | G-09 rewritten to describe the landed Status MVP scope. |

Net effect: ~190 added / ~30 removed across 12 changed files plus 1
new file (excluding package-lock churn).

Backend: **no change.** The `project_status_items` schema, REST
routes, default template, state-to-date rule, and MCP read tool are
all pre-P1-06.

## Verdict

**Approve as a "local complete" pass, with one required tightening
and several non-blocking recommendations.** The slice delivers the
visible P1-06 user-story additions — sanitized Markdown display +
edit-modal preview, drag/drop reorder layered over the existing
keyboard fallback, and a real modal confirm in place of
`window.confirm`. Backend wasn't touched, which is correct: the
TB-03 / TB-04b surface already covers US-Status criteria 5, 6, 7,
13, 14, and 15. The required fix is the missing sanitizer
defence-in-depth test (S1 below) — Markdown rendering is security-
critical and currently has zero unit coverage. Everything else is
quality or consistency work for P1-06 close-out, not a blocker.

The ledger row is honest: "Staging browser check remains pending
before marking complete." That gate sits in P1-13 (or the next
staging-credentials follow-up) — the same place TB-06 is parked.

---

## Findings

### High — Required before completing P1-06

#### H1. No tests cover the sanitizer; `StatusDescription` is security-critical and renders untrusted user input

`StatusDescription.tsx` is now the only path through which untrusted
user-authored content (the `description` field, up to 4000 chars,
shared across all editors and visible to public Viewers) is rendered
as HTML. The renderer composes four defenses:

1. `skipHtml` on `<ReactMarkdown>` (drops raw HTML in the source).
2. `allowedElements: ["p", "br", "strong", "em", "code", "a"]`.
3. `rehypeSanitize` with `tagNames` and `attributes.a = ["href",
   "title"]` and `protocols.href = ["http", "https"]`.
4. The custom `StatusExternalLink` re-asserts `/^https?:\/\//i` and
   forces `target="_blank" rel="noopener noreferrer"`.

This is the right shape, but the only new test in this slice is for
`orderIndexForDrop`. If any of the four defenses regresses (a future
upgrade of `react-markdown` flips a default, a tagName is added "for
images", a future maintainer turns `skipHtml` off because a Markdown
table didn't render, etc.), there is no automated signal. The
roadmap explicitly calls for "Tests: ... frontend state helpers
where non-trivial" — a sanitizer wrapping untrusted input is the
non-trivial frontend helper that most rewards a test.

Recommended: add a `frontend/src/features/project_status/components/StatusDescription.test.tsx`
(or extend `lib.test.ts`) with at least these assertions, rendered
through `@testing-library/react`:

1. A `<script>alert(1)</script>` literal in the description body
   appears as text, not as an executed/embedded script tag.
2. A Markdown link to `javascript:alert(1)` does **not** render as a
   clickable anchor (the `StatusExternalLink` early-return path
   should render the link text only).
3. A Markdown link to `https://example.com` renders an `<a>` with
   `target="_blank"` and `rel` containing `noopener` and `noreferrer`.
4. An `<img onerror=...>` literal does not render an `<img>` (because
   `img` is not in `allowedElements`).
5. Inline Markdown for `**bold**` / `*italic*` / `` `code` `` renders
   as the expected element (a regression signal that the allow-list
   isn't accidentally over-tightened).

The five assertions are short, run in the existing `vitest` + `jsdom`
setup, and don't require any new tooling.

Files: `frontend/src/features/project_status/components/StatusDescription.tsx`,
new test file alongside.

---

### Medium — Should fix before P1-06 closes, not blocking the local-complete sign-off

#### M1. `rehype-sanitize` schema's `attributes` field replaces (not extends) the default `*` wildcard list

```ts
const statusMarkdownSchema = {
  ...defaultSchema,
  tagNames: ["p", "br", "strong", "em", "code", "a"],
  attributes: {
    a: ["href", "title"],
  },
  protocols: {
    href: ["http", "https"],
  },
};
```

Spreading `...defaultSchema` keeps the default `attributes` object
on the schema; the next line `attributes: { a: [...] }` then
**replaces** the whole `attributes` map with `{ a: [...] }`. The
default-schema's `'*': ['className', 'id', ...]` wildcard, and the
`p`/`br`/`strong`/`em`/`code` entries, are no longer present.

Today the practical effect is more restrictive (no `className`
sneak-through, fine). But this is fragile: a future change to
`defaultSchema` won't propagate, and anyone reading the file is
likely to assume the spread merges deeply. Two equally clean
options:

1. **Merge explicitly:**

   ```ts
   const statusMarkdownSchema = {
     ...defaultSchema,
     tagNames: ["p", "br", "strong", "em", "code", "a"],
     attributes: {
       ...defaultSchema.attributes,
       a: ["href", "title"],
     },
     protocols: { ...defaultSchema.protocols, href: ["http", "https"] },
   };
   ```

2. **Drop the spread entirely** and build a small, fully-explicit
   schema. (Recommended — the allow-list is small and reads as
   intent rather than inheriting defaults.)

Either way, leave a one-line comment explaining the intent. The
unit-test from H1 should cover the regression.

File: `frontend/src/features/project_status/components/StatusDescription.tsx:23-32`.

#### M2. `ReactMarkdown` `allowedElements` overlaps with `rehype-sanitize` `tagNames`; one of them is redundant

Both `allowedElements` (a `react-markdown` prop) and `tagNames`
(in the `rehype-sanitize` schema) restrict the rendered element set
to the same list. Belt + suspenders is fine for defense-in-depth,
but the rationale isn't documented and a future maintainer will
likely "simplify" one away (and pick the wrong one).

If the intent is to defend in depth, leave both and add a comment
explaining why. If not, prefer the sanitizer (it runs on the HAST
tree after `skipHtml`, after Markdown -> HAST, and is the canonical
allow-list). Removing `allowedElements` cuts one path of
configuration drift.

File: `frontend/src/features/project_status/components/StatusDescription.tsx:8-15`.

#### M3. Delete dialog leaves itself open on error; the error surfaces outside the dialog

`StatusTab.deleteItem`:

```tsx
const deleteItem = (item: StatusItem) => {
  setActionError(null);
  deleteMutation.mutate(item.id, {
    onSuccess: () => setDeletingItem(null),
    onError: (error) => setActionError(errorMessage(error, "Could not delete item.")),
  });
};
```

On error:

- `setDeletingItem(null)` is **not** called, so the modal stays
  open.
- `setActionError(...)` writes to the page's `actionError`, which
  renders **outside the modal** (the `.form-error` block above the
  timeline).

The result for the user is a delete dialog still open over the
timeline, with the actual error message hidden behind the dialog
backdrop. Two options:

1. **Surface the error inside the dialog.** Pass an `error` prop to
   `StatusDeleteDialog`, render it under the body copy, and leave
   the dialog open for retry/cancel.
2. **Close the dialog and let the page-level error stand.** Move
   `setDeletingItem(null)` to `onSettled` (or to both success and
   error callbacks) so the dialog closes regardless.

Option 1 matches `StatusItemModal`'s pattern (which renders its own
form-level error inside the modal, e.g. line 114-118). Option 2 is
simpler but a worse UX. Recommend option 1 for consistency.

Files: `frontend/src/features/project_status/routes/StatusTab.tsx:55-61`,
`frontend/src/features/project_status/components/StatusDeleteDialog.tsx`.

#### M4. Drag-and-drop has no drop-target affordance; users can't see where the release will land

`StatusItemRow.handleDrop` computes placement from `clientY <
bounds.top + bounds.height / 2`, but nothing in the DOM changes
during `dragover` to show whether the dragged row will land
**before** or **after** the hovered target. The only feedback is
the browser's native ghost.

US-Status criterion 10 mandates drag-to-reorder; the gap matrix
G-09 rewrite claims drag/drop is landed. The functionality works,
but discoverability is weak. Combined with the placeholder `::`
character handle (P-1 below), an editor's first encounter with the
feature is "I dragged a row and... I think it moved? Did I drop it
above or below?".

Recommended (lightweight, no new dep):

1. Set a `data-drop-placement="before" | "after"` attribute on the
   hovered row during `onDragOver`, clear it on `onDragLeave` and
   `onDragEnd`.
2. CSS draws a 2px accent line on the corresponding edge using
   `var(--accent)`:

   ```css
   .status-item[data-drop-placement="before"] {
     box-shadow: 0 -2px 0 var(--accent) inset;
   }
   .status-item[data-drop-placement="after"] {
     box-shadow: 0 2px 0 var(--accent) inset;
   }
   ```

3. Bonus: a `data-dragging="true"` attribute on the source row to
   dim it to ~60% opacity for the duration of the drag.

This is a P1-06 polish item, not a blocker.

Files: `frontend/src/features/project_status/components/StatusItemRow.tsx:52-64`,
`frontend/src/App.css:935-960`.

#### M5. The visible drag handle (`::`) sets the wrong design precedent for the BLDGTYP system that P1-04 just established

P1-04 wired the BLDGTYP `tokens.css` palette and committed
PH-Navigator to use the published tokens for icons and chrome.
The new drag handle is literal text (`::`) styled with the mono
font:

```tsx
<span className="drag-handle" aria-label={`Drag ${item.title} to reorder`}>
  ::
</span>
```

```css
.drag-handle {
  color: var(--text-muted);
  cursor: grab;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1;
}
```

US-Status criterion 3 says "left rail, on hover" with a "grip icon".
UI/UX §2.5 echoes the grip-icon vocabulary. The current placeholder
characters render the same on every row regardless of hover.

Functionally it works; aesthetically it telegraphs "this is a TODO
placeholder, not the production design" to anyone screenshotting
the Status page for a Phase 1 demo. Two paths:

1. **Use a real grip glyph** — Unicode `⋮⋮` (U+22EE x 2), `⋮` alone,
   or `≡` would all read more clearly than `::`. No icon library
   needed.
2. **Defer to the shadcn/icon import in P1-08** and explicitly note
   that the `::` is a placeholder until then.

Either path needs to be recorded in the P1-06 lessons line so it
doesn't quietly become permanent. Today the gap matrix entry G-09
calls drag/drop "landed" without flagging the placeholder.

Files: `frontend/src/features/project_status/components/StatusItemRow.tsx:78-82`,
`frontend/src/App.css:959-965`.

#### M6. Segmented Edit/Preview control is missing semantic state for assistive tech

```tsx
<div className="segmented-control" aria-label="Description mode">
  <button type="button" className={descriptionMode === "edit" ? "active" : ""}
    onClick={() => setDescriptionMode("edit")}>Edit</button>
  <button type="button" className={descriptionMode === "preview" ? "active" : ""}
    onClick={() => setDescriptionMode("preview")}>Preview</button>
</div>
```

The visual `.active` state has no `aria-pressed` (toggle-button
pattern) and no `role="tablist"` / `role="tab"` / `aria-selected`
(tab pattern). A screen-reader user hears "Edit, button. Preview,
button." with no signal which one is active.

Two minimal fixes:

1. `aria-pressed={descriptionMode === "edit"}` on each button.
2. Or, since this controls a mutually-exclusive view, model it as a
   small tablist with `role="tab"` + `aria-selected` + `aria-controls`
   pointing at the textarea / preview region.

(1) is the smaller change. Either is appropriate for P1-06's
accessibility baseline.

File: `frontend/src/features/project_status/components/StatusItemModal.tsx:78-97`.

---

### Low — Quality / consistency nits, fix opportunistically

#### L1. CSS literal `border-radius: 6px` and `min-height: 112px` instead of tokens

P1-04 established `var(--phn-radius)` (mapped to BLDGTYP
`--radius-sm`) as the canonical corner radius. The new
`.segmented-control` and `.markdown-preview` rules use
`border-radius: 6px` (Lines 1146 and 1168 in `App.css`), and the
preview min-height is also a literal (`112px`, line 1166). These
are minor drift from the P1-04 token discipline.

If `--phn-radius` resolves to the same 6px today the cosmetic
result is identical; the cost is making the design system slightly
less searchable for "things to retint when the token changes".

Same notes for `#ffffff` literal text color on
`.segmented-control button.active` (line 1162): every other
high-contrast text in the app uses `var(--accent-text)` or a
sibling token.

File: `frontend/src/App.css:1143-1176`.

#### L2. Duplicate "Track this project's lifecycle milestones" copy on the empty state

`StatusTab.tsx:108`:

```tsx
<div className="status-heading">
  <div>
    <h2 id="status-title">Status</h2>
    <p>Track this project's lifecycle milestones.</p>
  </div>
  ...
</div>
```

`StatusEmptyState.tsx:16`:

```tsx
<h3>Track this project's lifecycle milestones.</h3>
```

On a brand-new project (zero items), both render simultaneously,
producing the same line of copy in two type sizes back-to-back.
The empty state's heading is the more deliberate of the two (it is
labelled `aria-label="Empty project status"` and exists to make the
empty state self-explanatory in isolation). The panel-header `<p>`
is redundant in the empty case and is the one to drop or vary.

Pre-existing from earlier slices but newly load-bearing now that
P1-06 calls Status "complete".

Files: `frontend/src/features/project_status/routes/StatusTab.tsx:105-109`,
`frontend/src/features/project_status/components/StatusEmptyState.tsx:14-19`.

#### L3. `orderIndexForDrop` and `orderIndexForMove` could share a single midpoint helper

Both functions end in the same three-branch midpoint formula:

```ts
if (before === undefined && after === undefined) return 1;
if (before === undefined) return (after ?? 1) - 1;
if (after === undefined) return before + 1;
return (before + after) / 2;
```

(The `??` fallback in `orderIndexForMove` is `item.order_index`
rather than `1`, but the early-return paths reach those branches
under different conditions so the effect is the same.) Pulling
this into a `midpoint(before, after)` helper would deduplicate the
fractional-index policy in one place and make the next "move"
variant (whatever P1-09 / P1-10 needs for the shared DataTable) a
one-line consumer.

Not load-bearing for P1-06.

File: `frontend/src/features/project_status/lib.ts:38-79`.

#### L4. HTML5 drag has no touch support; iOS Safari users fall back to keyboard

This is a property of `draggable="true"` + HTML5 DnD events on
mobile Safari — `onDragStart` simply doesn't fire from a touch. The
existing Alt+↑/Alt+↓ keyboard path covers desktop accessibility,
but iPad reviewers who open the public Viewer (or an editor opening
a project on tablet) have no reorder affordance at all.

For Phase 1 this is likely an explicit deferral (the gap matrix
G-09 does not call out tablet/touch). But the P1-06 lessons line
should record that drag-to-reorder is desktop-pointer-only in v1,
the same way TB-06 named explicit deferrals for read-safe
generalization. Otherwise "drag reorder landed" reads as broader
than it actually is.

Recommended: add one sentence to the P1-06 lessons row.

Files: `frontend/src/features/project_status/components/StatusItemRow.tsx:46-64`,
`planning/ROADMAP.html` P1-06 lessons row.

#### L5. P1-06 still has the click-to-edit-title-inline gap from criterion 8

US-Status criterion 8 says:

> Click title to edit title inline (Enter commits, Escape cancels,
> blur commits). For richer edits (description Markdown, state,
> date), `⋯ → Edit item` opens a small modal with the full row's
> fields.

Today, clicking the title button opens the modal (the row also has
no `⋯` menu — clicking Edit opens the same modal). Both deviations
are pre-existing from TB-03 and are not regressions in P1-06, but
P1-06 is the slice meant to close out US-Status. The gap matrix
G-09 rewrite claims "Local implementation/browser pass now covers
... add/edit/delete/state/date behavior" without naming the
deviations.

Two acceptable resolutions for P1-06 close-out (not for this slice
necessarily):

1. **Implement inline-edit.** Click title → contenteditable / input
   in place, Enter commits, Esc cancels, blur commits.
2. **Explicitly defer.** Record the deviation in the gap matrix
   G-09 lessons row (and the roadmap P1-06 lessons row) as a
   deliberate cut: "Inline title edit deferred; both pencil-Edit
   and title-click open the row modal." Then the slice can mark
   "criteria checked off or deliberately deferred" honestly.

The `⋯` row-action menu is the same kind of decision (criterion 3
calls for `⋯`; implementation uses inline Edit/Delete/move
buttons). The buttons read more cleanly than a hidden `⋯` for
desktop, and they're already in place; an explicit deferral note
is probably the right move.

#### L6. `deleteMutation.isPending` is shared across all dialogs; rapid open/close after an in-flight delete will mis-attribute "Deleting..." state

`useDeleteStatusItemMutation(projectId)` returns one mutation
keyed at the project level. If the editor:

1. Opens the delete dialog for item A, confirms (mutation fires).
2. Before the request returns, somehow opens the delete dialog for
   item B (race condition: the success callback fires after the
   user's click).
3. The B dialog will show "Deleting..." because `isPending` is
   `true` for the in-flight A delete.

This is essentially impossible to hit by hand and not worth a fix
on its own. But the pattern recurs (Rooms / Equipment / other
future per-row mutations) — recording it now keeps the per-row
`mutateAsync` + local pending state pattern as the canonical
choice for P1-08+ instead of the shared-mutation pattern.

File: `frontend/src/features/project_status/routes/StatusTab.tsx:55-61`.

---

## Conformance to US-Status Acceptance Criteria

Mapping the 15 US-Status criteria against the implementation after
P1-06 lands:

| # | Criterion | Status after P1-06 | Notes |
|---|---|---|---|
| 1 | Tab placement (default, single scroll, no sub-tabs) | ✅ | Pre-existing (TB-03). |
| 2 | Empty state with three CTAs | ✅ | Pre-existing (TB-03). |
| 3 | Vertical timeline rows (state icon, drag handle, title, date pill, description, `⋯` menu) | ⚠ Partial | State icon ✅, date pill ✅, description ✅. Drag handle is a `::` literal (M5), `⋯` menu is **absent** (Edit/Delete render as inline buttons instead). See L5. |
| 4 | Current-step visual (first `todo` highlight) | ✅ | Pre-existing (TB-03). |
| 5 | State toggle behavior (cycle, auto-populate date, preserve on flip-away) | ✅ | Pre-existing (TB-03 backend + frontend). |
| 6 | Completion date editing (auto-populate, edit, clear) | ✅ | Editable via the row modal; clear by emptying the `<input type="date">`. |
| 7 | Add custom item | ✅ | Pre-existing (TB-03). |
| 8 | Click-title-inline-edit + `⋯ → Edit item` modal | ⚠ Partial | Clicking the title opens the modal, not an inline editor. See L5. |
| 9 | Delete via `⋯ → Delete item` + dialog confirm | ⚠ Partial | Dialog confirm ✅ (new in P1-06). Source is the inline `Delete` button, not a `⋯` menu. |
| 10 | Drag + Alt+↑/Alt+↓ reorder | ✅ (desktop-only) | Drag ✅, keyboard ✅. Touch unsupported (L4). No drop-target affordance (M4). |
| 11 | Markdown display + preview/edit | ✅ | Sanitized renderer + edit-modal preview, both new in P1-06. Allow-list matches the criterion exactly. |
| 12 | No per-item attachments | ✅ | Description Markdown can link out via the sanitized `a` allow-list. |
| 13 | Editor full access; Viewer read-only | ✅ | Pre-existing (TB-03 + ProjectAccess seam). |
| 14 | Locked-version N/A (status is relational, not document-versioned) | ✅ | Backend separation pre-existing. |
| 15 | MCP-callable backend endpoints | ✅ | REST endpoints exist; MCP `list_status_items` exists (TB-04b). MCP `create`/`patch`/`delete`/`apply_default_template` tools are not implemented, but US-Status §15 only enumerates the REST endpoints. Cross-reference NEW-LLM-API-1 — write-capable MCP is the TB-17 / post-Phase-1 gate, not P1-06. |

Net: 11/15 fully ✅, 4/15 ⚠ with named deviations from the criterion
text. None of the deviations is hidden — they show up in the
findings above — but the gap matrix entry G-09 and the roadmap
P1-06 lessons row should both name them explicitly before P1-06 is
marked Complete.

---

## Security Notes

The sanitized renderer change is the most security-relevant part
of this slice. The defense-in-depth shape is right:

1. `skipHtml` blocks the source-text raw-HTML escape hatch.
2. `allowedElements` blocks tags at the JSX-render boundary.
3. `rehypeSanitize` filters the HAST tree.
4. `StatusExternalLink` re-asserts the `http(s)://` constraint
   before any anchor is rendered.

Each layer matches the criterion-11 allow-list, and the link
component independently forces `target="_blank" rel="noopener
noreferrer"`. The two specific risks I checked:

- **`javascript:` URLs.** Filtered three times — by
  `rehype-sanitize`'s `protocols.href = ["http", "https"]`, by the
  custom regex in `StatusExternalLink`, and by the fact that the
  rendered HAST node would be filtered before reaching the
  component anyway. The `StatusExternalLink` early-return path
  renders the link text without an `<a>` even if the upstream
  layers fail.
- **Raw HTML in description text.** `skipHtml` strips `<script>`,
  `<img onerror=...>`, etc. at the Markdown-parser layer; if an
  attacker tried bypassing it via `<` escapes, the HAST allow-list
  would still drop the tag.

The remaining gap is the absence of tests pinning these defenses
in place (H1). For a renderer of untrusted text, the test cost is
trivially small and the regression cost is large; the test should
land in this slice.

No other security regressions. The drag/drop handler doesn't read
or write any HTTP-attacker-controlled state; the new modal dialog
reuses the existing `ModalDialog` primitive.

---

## Architecture / Performance Notes

- **Backend boundary preserved.** Zero backend changes. P1-06 keeps
  the relational vs. JSONB split for `project_status_items` (the
  data-model decision recorded in US-Status' Architectural decisions
  block) and uses the existing REST routes through the existing
  TanStack Query feature hooks. The P1-01 / P1-02 boundary cleanups
  did not need to be revisited.
- **Bundle impact.** `react-markdown@^10.1.0` + `rehype-sanitize@^6.0.0`
  pull `unified`, `remark-parse`, `remark-rehype`, `mdast-util-*`,
  `hast-util-to-jsx-runtime`, and `vfile` into the runtime bundle.
  Order of magnitude: ~30-40 KB gzipped. Today it loads on the
  Status tab (default project landing), so every project open pays
  for it. Acceptable for Phase 1 (matches US-Status criterion 11);
  worth revisiting in P1-13 if the bundle baseline check picks it
  up. A lazy-load via `React.lazy` on `StatusDescription` would let
  the empty state and timeline render before the renderer arrives,
  but is not needed yet.
- **Fractional index policy.** `orderIndexForDrop` mirrors
  `orderIndexForMove`'s midpoint policy correctly. The US-Status
  edge-case note about float64 precision after 30+ insert-between
  ops is still future work; not in P1-06 scope.
- **Drag/drop architecture.** HTML5 DnD on the article element is
  the lightest possible implementation. No dnd-kit / react-beautiful-dnd
  / @dnd-kit subtree. The trade-off is no touch support (L4) and
  no drop-indicator affordance (M4). Both are recoverable in a
  later UX polish slice without throwing away this work.
- **Server-state shape.** `setQueryData` upserts via `sortStatusItems`
  on every mutation, which means the drag-drop optimistic update
  goes through the same sort/dedup path as add/edit. No new query
  invalidation needed.
- **MCP write coverage.** US-Status criterion 15 lists REST routes
  only; the MCP `list_status_items` read tool (TB-04b) is in place.
  MCP `create_status_item` / `patch_status_item` / etc. are *not*
  implemented and are correctly out of scope per the roadmap's
  "Phase 1 keeps MCP read-only" posture (TB-17 + decision queue).

---

## PRD / Context-Doc Drift

- **No drift detected** in the implementation relative to US-Status
  criterion 11 (Markdown allow-list).
- **Drift between US-Status criterion 3 / 8 / 9 and the
  implementation** — the `⋯` row-action menu and click-to-edit-inline
  title are documented but not implemented (pre-existing from TB-03,
  not new in this slice). The gap matrix G-09 rewrite should name
  these as deliberate deferrals or schedule a follow-up in P1-06.
- **UI/UX §2.5 reference image** describes a "grip handle" — the
  current `::` literal is the placeholder noted in M5.
- **No drift in the data-model section** of US-Status; the schema
  is unchanged.

---

## Suggested Action Plan Before P1-06 → Complete

1. **Required:** Add the sanitizer test file from H1 (five
   assertions, ~20 lines).
2. **Should:** Fix M1 (`attributes` merge), M3 (delete-error UX),
   M6 (`aria-pressed` on segmented control). All small.
3. **Should:** Decide M5 (drag-handle glyph) — either change to a
   real grip-style Unicode glyph now or record the placeholder in
   the lessons row.
4. **Should:** Add the L5 deferrals (`⋯` menu, inline-title edit) to
   the roadmap P1-06 lessons row and the gap matrix G-09 entry, or
   schedule a P1-06 follow-up pass.
5. **Optional / can ride along:** M4 (drop-target affordance), M2
   (allow-list dedup), L1-L4, L6.
6. **Hold for the staging slot:** the existing "staging browser
   check pending" gate carries over from TB-06; same blocker
   (staging editor credentials). P1-13 owns the eventual close-out.

After (1)-(4), this slice satisfies the P1-06 completion gate
documented in the full-buildout plan: "US-Status criteria are
checked off or deliberately deferred in the gap matrix; local and
staging browser checks cover empty state, template apply, edit,
reorder, delete, Viewer read-only, and current-step visual."

---

## Verification Summary

Captured from the roadmap ledger row (lines 597-598):

```
cd backend && uv run pytest tests/test_project_status.py (6 passed)
cd frontend && npm run format:check
cd frontend && npm run lint
cd frontend && npm test (25 passed)
cd frontend && npm run build
cd frontend && npm run test:e2e (2 passed)
```

Plus in-app browser smoke at
`http://127.0.0.1:5173/projects/.../status` for Markdown preview /
display and Status layout.

The verification set matches the roadmap's "Verification Budget"
guidance for a UI-heavy slice. Re-running the full `make lint /
typecheck / test` battery before the slice closes is recommended
(the ledger row only documents the focused subset).

Staging verification: still pending, same blocker as TB-06.
