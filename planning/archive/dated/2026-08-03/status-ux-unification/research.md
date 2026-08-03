DATE: 2026-08-03
TIME: 11:25 EDT
STATUS: Complete — as-is inventory verified against source on 2026-08-03
AUTHOR: Claude with Ed May
SCOPE: Where every status concept lives today, with file/line references,
  and the duplications/divergences this packet removes.
RELATED:
  - ./README.md
  - ./PRD.md
---

# Research — as-is status inventory (2026-08-03)

Line numbers are from main on 2026-08-03; re-verify before editing.

## 1. Four backend systems

| System | Storage | Values | Owner |
| --- | --- | --- | --- |
| A. Roadmap milestones | relational `project_status_items` | `todo/done/na` | `backend/features/project_status/` |
| B. Spec status, option-id family (12 equipment/TB tables) | `row.custom_values["status"]` | `opt_status_{complete,needed,question,na}` | `backend/features/project_document/tables/_status_field.py` |
| C. Spec status, typed family (materials/glazings/frames) | `specification_status` column | `complete/needed/question/na` | `backend/features/project_document/envelope_models.py:34` |
| D. Evidence axes | `datasheet_status`, `photo_status` (+ `*_not_required`) | `needed/complete/na` | `envelope_models.py:36`; equipment via attachment service |

Key facts:

- `_status_field.py`: `STATUS_FIELD_KEY="status"`, `STATUS_DISPLAY_NAME=
  "Specification Status"` (:29-30), option ids (:32-35), default `needed`
  (:38), colors (:71-76), built-in FieldDef with description "Record
  completeness for dashboard accounting." (:79-87), 12-table list (:52-65).
- Materials carry spec + datasheet axes (`envelope_models.py:303-306`);
  **photos live on `AssemblySegment`** (:162-176) — one datasheet per
  product, photos per use-site (`context/technical-requirements/
  data-model.md:672-687`). Glazings (:354-360) and frames (:416-422) carry
  all three axes.
- Upload auto-complete: attaching a file sets that axis `complete`
  (`backend/features/assets/service.py:70-73, 547-548`).
- N/A cascade: spec `na` forces both evidence axes `na` + not-required
  (`documentation_summary.py:421-425`).
- Permanent Honeybee adapter `needed ↔ MISSING`
  (`backend/features/envelope/honeybee_specification_status.py`); temporary
  `missing→needed` compat shim (`specification_status_compat.py`) pending
  the spec-status packet's Phase 07.

## 2. The twin summary modules

`backend/features/project_document/status_summary.py` (Status tab pane,
spec axis only, discipline grouping) and `documentation_summary.py`
(Documentation tab, three axes, nav-tab grouping) duplicate:

- `_STATUS_BY_OPTION_ID` (`status_summary.py:226-231` ==
  `documentation_summary.py:213-218`);
- display-name fallback + `_string_value` helpers
  (`status_summary.py:320-338` ≈ `documentation_summary.py:480-518`);
- the `custom_status` vs `specification_status` dispatch.

Routes: status summary `routes.py:90` (saved) / `:129` (draft);
documentation summary `routes.py:98` / `:137`. Documentation section
anchors: `apertures`, `envelope`, `equipment`, `thermal-bridges`, group
anchors per table / `assembly-{id}`
(`documentation_summary.py:140-191, 269-284`).

"Resolved" exists nowhere in the backend — it is a frontend-derived
`complete + na` rollup.

Documentation "done" counting (`documentation_summary.py:521-533`): spec
done = `{complete, na}`; evidence done = `{complete, na}` or spec `na`.
Envelope photo rollup across segments: `_group_photo_status` (:464-477).

## 3. Frontend surfaces and their divergences

### Controls — five renderings of the same states

1. `shared/ui/StatusSelect.tsx` — pill-select; used only by
   `DocumentationRecordViews.tsx:260` and `MaterialsPanel.tsx:241` despite
   claiming to be the universal control.
2. `AutocompleteSelect` + `StatusDot` — Apertures report editor
   (`ApertureSpecReportPanel.tsx:793-800`).
3. `shared/ui/report-table/StatusPill.tsx` — Apertures viewer.
4. `shared/ui/data-table/components/SingleSelectCell.tsx:13-46` —
   `SingleSelectStatusPill` with icons, own styling.
5. `record-status-chip` — Status page read-only chip
   (`RecordStatusSummary.tsx:413-415`).

### Labels — drift table

| Surface | Spec-axis header | Datasheet | Photos |
| --- | --- | --- | --- |
| DataTables | `Specification Status` (`shared/ui/data-table/status.ts:4`) | `Datasheet` | `Site Photos` |
| Materials panel | `Status` (`MaterialsPanel.tsx:238`) | `Datasheet` col / `Datasheets` heading | `Photos` col / `Site photos` heading |
| Apertures panels | `Status` (`ApertureSpecReportPanel.tsx:684`) | `Datasheet` / `Datasheets` | `Site photos` |
| Documentation rows | `Spec` (`DocumentationRecordViews.tsx:88`) | `Datasheet` | `Photos` |
| Documentation meters | `Spec` | `Datasheets` | `Photos` |
| Documentation chips | `Needed specs` | `Missing datasheets` | `Missing photos` |

"Not done" phrasing: "need attention" (Status page), "still need attention"
(Documentation), "Needed" (option), "unfinished"
(`UValueReportPanel.tsx:102-111`).

### Structure

- Status tab (`features/project_status/routes/StatusTab.tsx`) = Roadmap
  (relational) + `RecordStatusSummary` (spec axis only, discipline
  taxonomy Mechanical / Domestic Hot Water / Envelope / Thermal Bridges
  from `status_summary.py:168-220`; renders empty groups as "No records").
- Documentation (`features/documentation/`) = three axes, nav-tab taxonomy,
  hides empty groups (`DocumentationSummaryView.tsx:339`).
- `EVIDENCE_STATUS_OPTIONS` hand-duplicates Needed/Complete/N/A
  (`documentation/lib.ts:27-33`) instead of deriving from
  `features/project_document/specification-status.ts` (the one genuinely
  shared vocabulary file).
- Two status column builders: `equipment/lib/statusColumn.ts:17-31` and
  `equipment/heat-pumps/status-column.ts:12-37`.
- Milestone strings: `project_status/lib.ts:5-30` (`To do/Done/N/A`), modal
  field label `State`, modal titles "Add status item" / "Edit status item"
  (`StatusItemModal.tsx`).

## 4. Deep-link mechanics (verified 2026-08-03)

- Hash anchors work today: `DocumentationSummaryView.tsx:67-86` expands the
  matching section/group and scrolls (`#equipment`, `#assembly-{id}`, …).
  The legacy `/envelope/site-photos` route redirects to
  `/documentation#envelope`.
- Axis filter chips are pure local state
  (`DocumentationSummaryView.tsx:48 activeFilters useState`) — **no URL
  param exists**; `?needs=` is net-new.
- No other feature links into `/documentation` today (grep 2026-08-03), so
  the Overview meters will be its first inbound deep links.
- Routing: generic `/projects/:projectId/:tab/*` → `ProjectShell`
  (`app/router.tsx:130`); tab slugs/labels in `features/projects/lib.ts:4-40`
  (`PROJECT_TABS`, `TAB_LABELS`, `TAB_COPY`, `projectStatusPath`); default
  landing falls back to `projectStatusPath`
  (`ProjectShell.tsx:59, 118, 201`). Redirect precedent that preserves
  search + hash: `RoomsToSpacesRedirect` (`app/router.tsx:168-180`).

## 5. Documented semantics today

- `context/UI_UX.md:499-528` §1.8 evidence grammar — a fourth vocabulary
  (Missing/Required/Attached/…) matching no enum; needs a rewrite to the
  PRD §2 contract in Phase 05.
- `context/GLOSSARY.md:131-132` (Specification Status, three axes), `:181`
  (flags "Status" ambiguity).
- `context/ui/pages/status-tab.md`, `documentation-tab.md` — both rewritten
  in Phase 05.
