DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Accepted — phase sequence for the status UX unification
AUTHOR: Claude with Ed May
SCOPE: Five independently shippable phases, each with scope, key edits,
  risks, and verification gates. Author `phases/phase-NN-*.md` handoffs when
  picking a phase up.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./decisions.md
  - ./research.md
---

# PLAN — Status UX unification

Ordering principle: pure-rename work first (01), visual consolidation next
(02), then the deep-link plumbing (03) that the structural change (04)
depends on, then deletion + docs (05). Every phase leaves `main`
deployable; nothing changes stored document values at any point.

## Phase 01 — Vocabulary, labels, tooltips, legend

**Scope:** create the single vocabulary source and land every string from
PRD §2; add tooltips and the shared legend.

Key edits:

- Extend `frontend/src/features/project_document/specification-status.ts`
  into the vocabulary module: axis labels (cell + meter + chip variants),
  axis tooltips, legend copy, rollup phrase helpers
  (`needAttentionLabel(n)`, `resolvedLabel(n, m)`). Derive
  `EVIDENCE_STATUS_OPTIONS` (`documentation/lib.ts:27-33`) from it instead
  of hand-listing.
- Rename headers/strings per PRD §2.1 across: `MaterialsPanel.tsx`,
  `ApertureSpecReportPanel.tsx`, `DocumentationRecordViews.tsx`,
  `DocumentationSummaryView.tsx` (chips, meters, attention line),
  `UValueReportPanel.tsx` ("unfinished" → "need attention"),
  `RecordStatusSummary.tsx` (interim strings only — pane is replaced in 04;
  skip anything nontrivial there).
- Roadmap copy: "Add milestone" / "Edit milestone" / "Save milestone" in
  `StatusItemModal.tsx`.
- Add header tooltips (shared `Tooltip`) and select `title`/aria wiring for
  the three axes; add the legend popover component and mount it on
  Documentation and both report panels (Overview gets it in 04).
- Backend description check: the built-in status FieldDef `description`
  (`_status_field.py:85`) is persisted and fingerprinted, so changing it would
  violate this packet's no-schema-change invariant. Keep it stable and supply
  the Spec. Status tooltip through the frontend render overlay (O-1).
- **O-1 verification (do first):** trace whether built-in FieldDef
  `display_name` is persisted in saved documents or code-derived at read
  time. Code-derived → rename `STATUS_DISPLAY_NAME` to "Spec. Status"
  backend-side (check `gh_api` exports + tests for coupling). Persisted →
  frontend display override in the two status column builders and leave
  the constant alone. Record the finding in `decisions.md`.

Verification: grep audit for retired spellings (PRD §6.1); focused RTL
updates; `make frontend-dev-check`; browser smoke of one report panel + one
DataTable + Documentation; `make ci` before merge.

Risk: the display-name question (O-1) — resolve before writing code.

## Phase 02 — One control + CSS token consolidation

**Scope:** collapse the five status renderings onto
`StatusSelect`/`StatusPill` and the `report-status-chip` token family (D-8).

Key edits:

- `ApertureSpecReportPanel.tsx:777-810`: replace `AutocompleteSelect` +
  `StatusDot` with `StatusSelect`; delete the dot if orphaned.
- `SingleSelectCell.tsx` (`SingleSelectStatusPill`): restyle onto
  `--report-status-*` tokens; keep the icon affordance only if it survives
  the shared look (prefer dropping bespoke icons for uniformity).
- Merge the two DataTable status column builders
  (`equipment/lib/statusColumn.ts`, `equipment/heat-pumps/status-column.ts`)
  into one.
- CSS: single token block for chip colors; retire the
  `--report-status-missing` alias by renaming its non-status consumers
  (Climate gaps, Documentation error/zero meters) to a neutral token —
  coordinate with the spec-status packet's Phase 07 so the two cleanups
  don't collide in one diff.
- Design-system guard: confirm `context/DESIGN_SYSTEM.md` component
  inventory lists the consolidated pill; update snapshot values if tokens
  moved.

Verification: side-by-side screenshots of all five surfaces (agent
browser); RTL for the swapped Apertures control; `make ci`.

## Phase 03 — Documentation URL-addressable filters

**Scope:** `?needs=spec,datasheet,photo` as shareable filter state (D-10).

Key edits in `DocumentationSummaryView.tsx` (or a small hook beside it):

- Initialize `activeFilters` from the param; toggle writes it back via
  `useSearchParams` with `replace: true` (no history spam); empty set
  removes the param.
- Compose with the existing hash effect (`:67-86`) — param parsing must not
  break `#anchor` expand/scroll; test `?needs=datasheet#equipment`.
- Ignore unknown values silently; keep values order-insensitive.

Verification: RTL cases (param→chips, chips→param, invalid values,
param+hash combo); browser smoke of PRD §6.3; `make ci`.

## Phase 04 — Overview tab: rename, rollup endpoint, meters

**Scope:** the structural change (D-3, D-5, D-6). Depends on 03.

Backend:

- Add a counts-only rollup projection in `documentation_summary.py` (reuse
  the existing builders, strip records): sections → groups → axis counts +
  anchors. New routes `GET .../document/documentation-rollup` and
  `.../draft/documentation-rollup` mirroring the summary's access rules.
  Keep payload record-free (status-tab perf invariant).

Frontend:

- `features/projects/lib.ts`: `PROJECT_TABS` `status` → `overview`;
  `TAB_LABELS.overview = "Overview"`; `TAB_COPY` per PRD §4.1; rename
  `projectStatusPath` → `projectOverviewPath` (fix `ProjectShell.tsx:59,
  118, 201` and other callers).
- `app/router.tsx`: add `StatusToOverviewRedirect` for
  `/projects/:projectId/status/*` modeled on `RoomsToSpacesRedirect`
  (preserve search + hash).
- Replace `RecordStatusSummary` usage in `StatusTab.tsx` with the new
  meters pane (per PRD §4.1): section rows, three meters each, attention
  count, deep links `/documentation?needs={axis}#{anchor}`, hidden empty
  sections, legend affordance, and per-group meter disclosure (D-12).
  New TanStack Query hook on the rollup endpoint; keep Roadmap
  and meters requests independent with separate skeleton/error states.
- Session-storage keys for disclosure state: new keys; no migration needed.

Verification: PRD §6.4 + §6.5 in the agent browser (editor draft + viewer
saved paths); redirect test incl. hash/search preservation; counts
cross-checked against Documentation header meters on the seeded fixture;
`make ci`.

Risk: default-landing path changes (`ProjectShell` fallback) — make sure
`/projects/{id}` still lands on Overview and breadcrumbs update.

## Phase 05 — Retire `status_summary.py` + docs sync

**Scope:** deletion, dedupe, and making the docs tell the new story (D-7).

- Consumer sweep gate (do first): grep backend/frontend/tests/MCP/gh_api
  for `status-summary`, `status_summary`, `RecordStatusSummary`,
  `features/project_status/summary`. Roadmap `status-items` and MCP
  `list_status_items` are out of scope and stay.
- Delete `status_summary.py`, its two routes, frontend
  `project_status/summary.ts` + `RecordStatusSummary.tsx` + styles + tests.
- Collapse the shared helpers: `_STATUS_BY_OPTION_ID` and the record
  display-name/value helpers live once (in `_status_field.py` /
  `documentation_summary.py`).
- Context docs: rewrite `context/ui/pages/status-tab.md` →
  `overview-tab.md` (update the CLAUDE.md dispatch table row and
  `context/README.md` router), update `documentation-tab.md` (`?needs=`
  contract, legend), rewrite `UI_UX.md` §1.8 onto the PRD §2 vocabulary,
  update `GLOSSARY.md` ("Overview", axis names, resolved/need-attention),
  and `TAB_COPY` references anywhere in docs.
- Update `planning/STATUS.md`; archive this packet when done.

Verification: consumer sweep clean; `make ci`; `graphify update .`;
docs-pass skill.

## Cross-phase gates

- Closeout gate per repo CLAUDE.md on every phase (simplify, docs-pass,
  `make format`, `make ci`).
- No phase touches stored values, option ids, or schema version — if one
  seems to need to, stop and re-plan.
- Concurrent-committer discipline: stage + commit atomically per session.
