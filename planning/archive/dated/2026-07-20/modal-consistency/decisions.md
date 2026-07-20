---
DATE: 2026-07-20
TIME: 18:05 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Accepted decisions for the modal-consistency refactor.
RELATED:
  - ./PRD.md
  - ./PLAN.md
---

# Decisions — Modal Consistency Refactor

## D-1 — Contract ratified (2026-07-20)

Ed ratified the full modal contract in `PRD.md §"The Modal Contract"`:

- **Dismiss:** footer `Cancel` is canonical; drop the top-right header "Close"
  except on read-only viewers with no footer.
- **Footer:** always `DialogActions`; Cancel (left) + styled primary (right);
  no bare/unstyled buttons; destructive primary uses `danger-button`.
- **Labels:** literal "Cancel"; specific primary verb; standard busy ellipsis.
- **Box:** shared `.modal-panel`; **oversized (vertically/horizontally
  scrolling) modals get a lower-right resize handle** via native `resize` on the
  scroll panel.
- **Backdrop-click:** **off** for forms / anything with unsaved input; **on**
  for read-only viewers.

## D-2 — `DialogActions` multi-action shape (resolves PRD Open-Q #1)

**Decision: extend `DialogActions` with an optional `extraActions` slot** placed
between Cancel (left) and the primary (right), rather than a separate stacked
"action list" variant.

- Rationale: keeps a single footer component and one layout contract; the
  Cancel-left / primary-right anchors stay fixed while secondary/tertiary
  actions (e.g. "Save As…", "Discard draft") sit in the middle in a predictable
  order. Avoids a second divergent footer pattern.
- Consumers: `DocumentConfirmationDialog` (switch/stale-save/unlock variants),
  `WeatherStationPickerModal`, `CatalogOptionCascadeProgressModal`.
- Gates Phase 04; the slot itself is built in Phase 00.

## D-3 — data-table Radix family disposition (resolves PRD Open-Q #2)

**Decision: keep the `@radix-ui` dialog/alert primitives; conform their shell to
the contract** rather than migrating them onto `ModalDialog`.

- Rationale: the Radix family already provides focus-trapping and accessible
  dialog semantics; ripping it out to adopt `ModalDialog` risks regressing a11y
  for the app's most complex modals (`FieldConfigModal` ~960 lines) for a purely
  visual gain. Lower risk to bring width/padding to the shared box, route the
  footer through the `DialogActions` shape, apply the header-Close rule, and add
  the resize affordance to `FieldConfigModal`.
- Follow-up: if `ModalDialog` later grows its own focus-trap, revisit unifying
  the two shells. Not in scope for this refactor.
- Governs Phase 06.

## D-4 — Packet lives on the sidebar branch (2026-07-20, circumstantial)

`CATALOG.md` was swept into sidebar commit `11a4a861` by a concurrent `git add`
during authoring. To keep the packet whole without history surgery on a bundled
commit, the remaining packet files are committed on the same
`feature/sidebar-redesign-1a-quiet-list` branch. If a dedicated
`refactor/modal-consistency` branch is wanted before implementation starts, it
should branch from wherever this packet ultimately merges to `main`.
