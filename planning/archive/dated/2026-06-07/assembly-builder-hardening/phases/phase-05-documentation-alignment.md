---
DATE: 2026-06-07
TIME: 17:25 EDT
STATUS: Partial (2026-06-07) — Shipped four new context docs
        (envelope-hbjson-export.md, envelope-thermal-preview.md,
        envelope-catalog-drift.md, envelope-commands.md) and added a
        §9.10b envelope inventory to api.md. Deferred: GLOSSARY paint-
        mode / drift-states expansion, UI_UX §2.7 paint-mode write-up,
        PRD §6.2 pointer, planning hygiene (archived
        assembly-builder-tools README + Q-AB-2 orphan-rationale audit),
        and the final 20-envelope.md status sweep.
AUTHOR: Ed May (with Claude)
SCOPE: Document the shipped envelope behaviors that currently have no
       doc anchor, and resolve the stale planning artifacts identified
       in the 2026-06-07 review. Runs after the other phases so docs
       describe the verified, refactored state.
RELATED:
  - planning/code-reviews/2026-06-07/assembly-builder-review.md §5
  - context/technical-requirements/hbjson-export.md
  - context/technical-requirements/api.md
  - context/PRD.md §6.2
  - context/user-stories/20-envelope.md
  - context/GLOSSARY.md
  - planning/archive/assembly-builder-tools/PRD.md
---

# Phase 5 — Documentation Alignment

## P0. Why this slice

The 2026-06-07 review found that several **shipped, fully-tested backend
contracts** have no doc anchor anywhere in `context/`. The most
egregious gap is the opaque-construction HBJSON export — there is an
apertures-only `hbjson-export.md` describing the window export contract,
while the parallel opaque-construction export ships in
`backend/features/envelope/hbjson_export.py` with full test coverage and
zero docs.

Other gaps:

- `api.md` never inventories the envelope routes.
- The thermal preview's user-facing flag vocabulary is undocumented.
- The catalog drift report's five-state contract is undocumented.
- The 24-entry semantic command catalog (the API the MCP server and
  frontend both call) lives only in `commands/registry.py`.
- The `assembly-builder-tools/PRD.md` is called "the product contract"
  by its own README but lives in `planning/archive/`.
- The May-27 review reads as live but is fully resolved (Phase 1
  already adds a header note; Phase 5 finishes the loop by sweeping
  the planning index for any references that perpetuate the
  misleading framing).

This phase runs last because:

1. Phase 4 refactors may change file/hook names. Docs reference the
   final names.
2. Phase 1's status sweep on `20-envelope.md` is partial; Phase 5
   completes the cross-reference back-fill.
3. The Q-AB-2 archive audit (P2.9) depends on knowing what made it
   into `context/` across the other phases — running it last is the
   only way the audit can correctly classify orphan rationale.

## P1. Acceptance — Phase 5 done when

### New context documents

- [ ] `context/technical-requirements/envelope-hbjson-export.md` exists,
      mirroring the structure of `hbjson-export.md`, and covers:
  - the route (`/envelope/export/hbjson`),
  - the `PHNavigatorOpaqueConstructionLibrary` payload type,
  - identifier cleaning rules (`_clean_identifier`),
  - assembly-name collision disambiguation policy,
  - material identifier shape (`{name}_{id}_{thickness_in}in`),
  - layer ordering (outside → inside) and the
    `last_layer_outside` reversal,
  - hybrid-layer `divisions.cells` schema,
  - `EnergyMaterialRefProperties` carrying `ref_status` +
    `document_refs`,
  - saved-vs-draft separation (HBJSON export always reads the saved
    version body),
  - a short explicit note that steel-stud cavity handling
    (`is_a_steel_stud_cavity`, `steel_stud_spacing_mm`) is
    intentionally undocumented at this layer pending a separate
    review (per Q-AB-1, 2026-06-07). The fields exist in the export
    payload; their semantics are not described here.
- [ ] `context/technical-requirements/envelope-thermal-preview.md`
      exists and covers:
  - the route (`/envelope/assemblies/{id}/thermal`),
  - the user-facing flag vocabulary (`missing_material`,
    `missing_conductivity`, `invalid_geometry`,
    `broken_material_reference`),
  - the `is_complete` derivation,
  - the input-hash cache contract (physics fields only — name and
    color do not perturb the hash),
  - the two ASHRAE Ch. 25 methods (Parallel-Path and Isothermal-
    Planes), the PH-average policy, and the citation
    (ASHRAE Fundamentals or equivalent).
- [ ] `context/technical-requirements/envelope-catalog-drift.md` exists
      and covers:
  - the route (`/envelope/material-catalog-drift`),
  - the five enumerated states (`drifted`, `customized`, `in_sync`,
    `source_deactivated`, `source_missing`),
  - the per-field shape (`project_value`, `catalog_value`,
    `is_overridden`, `differs`),
  - how the frontend renders badges off the contract,
  - the `refresh_project_material_from_catalog` command's three
    actions (`take_catalog`, `use_value`, `keep_mine`) and which
    fields each affects.
- [ ] `context/technical-requirements/envelope-commands.md` exists and
      lists the 24 command kinds in `commands/registry.py`. For each:
  - JSON shape (or schema reference to `models.py`),
  - preconditions,
  - conflict codes (e.g., `last_layer`, `last_segment`,
    `ambiguous_catalog_material`, `catalog_material_not_found`,
    `segment_has_no_material`,
    `project_material_has_no_catalog_origin`,
    `catalog_material_source_missing`,
    `catalog_material_source_deactivated`,
    `unknown_project_material_refresh_field`).
  - This is the API the MCP server and the frontend both call; treat
    it as a first-class contract.

### Updates to existing docs

- [ ] `context/technical-requirements/api.md`: §9.x route inventory now
      includes:
  - `GET /envelope`,
  - `GET /envelope/assemblies/{id}/thermal`,
  - `GET /envelope/material-catalog-drift`,
  - `POST /envelope/export/hbjson`,
  - `POST /draft/envelope/commands`,
  - the existing `assembly-segment` schema reference now links to the
    new `envelope-commands.md`.
- [ ] `context/GLOSSARY.md`: `Refresh from catalog` entry expanded to
      enumerate the three `action` values; `Drift` entry expanded to
      enumerate the five states; entries added for `Paint mode`,
      `Eyedropper`, `Paint bucket` (the canvas state machine).
- [ ] `context/UI_UX.md` §2.7: paint-bucket / eyedropper state machine
      described with the dedup and undo semantics. Reference the
      backend command (`paste_assignment`) for traceability.
- [ ] `context/PRD.md` §6.2: add a one-line pointer noting the document-
      body sketch is illustrative; canonical shape lives in
      `context/user-stories/20-envelope.md` §134-186.
- [ ] `context/user-stories/20-envelope.md`: any sub-story statuses
      Phase 1 left ambiguous are resolved here, post-verification.

### Planning hygiene

- [ ] `assembly-builder-tools/` README updated per Option A: stops
      calling its archived PRD "the product contract," delegates
      behavior questions to `context/`, marks itself `Superseded`.
- [ ] Archived-PRD orphan-rationale audit is recorded in this
      folder's `STATUS.md` (or `decisions.md` if it grows long), with
      each finding either fold-forwarded to context or explicitly
      classified as planning-history-only.
- [ ] `planning/STATUS.md` (top-level) references the
      `assembly-builder-hardening` feature folder.
- [ ] No planning index file (`README.md`, `STATUS.md`,
      `ROADMAP.html`) references the May-27 review without an updated
      "resolved" pointer.

### Verification

- [ ] `make ci` is green (docs changes do not break CI; this gate is
      cheap insurance against accidental code edits).
- [ ] A reader landing on `context/README.md` for the first time can
      find every shipped envelope contract within two clicks.

## P2. Implementation steps

### P2.1 Start with the envelope-hbjson-export contract

This is the single highest-impact gap. Mirror the structure of
`context/technical-requirements/hbjson-export.md` exactly:

1. **Overview** — what the endpoint produces and why.
2. **Endpoint** — route, method, request body shape, response shape.
3. **Payload type** — `PHNavigatorOpaqueConstructionLibrary`, with
   fields enumerated.
4. **Identifier rules** — `_clean_identifier`, assembly disambiguation,
   material identifier construction.
5. **Layer ordering** — outside → inside semantics, the
   `last_layer_outside` reversal rule, citation to the orientation
   model.
6. **Hybrid layers** — `divisions.cells` schema and when it applies.
7. **Reference status** — `EnergyMaterialRefProperties` carrying
   `ref_status` + `document_refs`.
8. **Saved-vs-draft policy** — export reads saved version body.
9. **Error responses** — 422 with `thermal_issues` flags.
10. **Explicitly deferred topics** — one short sub-section noting that
    steel-stud cavity handling is intentionally undocumented at this
    layer pending a separate review (cite Q-AB-1 / 2026-06-07).
    Future readers should not interpret the omission as accidental.

Use the existing `hbjson-export.md` as a structural template, not a
content template.

### P2.2 Envelope thermal preview contract

Smaller doc. Sections:

1. Endpoint and request/response shape.
2. The two ASHRAE methods (with citation) and the PH-average policy.
3. The flag vocabulary and when each flag fires.
4. The `is_complete` derivation.
5. The input-hash contract.

The thermal `thermal.py` module-level docstrings are already good;
this doc translates them into a context-level contract.

### P2.3 Catalog drift report contract

Sections:

1. Endpoint and response shape.
2. The five states, with one sentence per state on when each fires.
3. The per-field drift shape.
4. The `refresh_project_material_from_catalog` command's three
   actions and what each affects.
5. Cross-reference to `GLOSSARY.md`'s `Drift` and `Refresh from
   catalog` entries.

### P2.4 Envelope command catalog

The most mechanical doc. For each of the 24 entries in
`commands/registry.py`, list:

- Name (`kind` value).
- One-sentence purpose.
- Request body shape (link to `models.py` rather than duplicate the
  schema).
- Preconditions.
- Conflict codes.

Tabular format works well here. Group by domain (assembly / layer /
segment / material).

This doc is the single best onboarding resource for the MCP integration
and any future API client. Worth the effort.

### P2.5 Update `api.md`

Open `context/technical-requirements/api.md`. Find the §9.x route
inventory section (the existing apertures + envelope-adjacent surface).
Add the five envelope routes with brief descriptions. Link each to its
corresponding new contract doc.

### P2.6 Glossary expansions

Open `context/GLOSSARY.md`. Update entries:

- `Refresh from catalog` — add the three action values.
- `Drift` — add the five states.
- New entries: `Paint mode`, `Eyedropper`, `Paint bucket`,
  `Assembly orientation`.

Keep entries to two or three sentences each. Cross-link with `[[name]]`
where the project's glossary convention supports it (or with markdown
links if not).

### P2.7 UI_UX paint-mode write-up

Open `context/UI_UX.md` §2.7 (envelope tab). Add a sub-section
describing the paint-mode state machine:

- Eyedropper picks a segment's assignment.
- Paint bucket pastes the picked assignment onto a target segment.
- Undo reverses the last paste.
- Dedup behavior on rapid clicks.
- Escape key clears.

Reference the backend command (`paste_assignment`) and the relevant
tests (`EnvelopeCanvas.interaction.test.tsx`).

### P2.8 PRD §6.2 pointer

Open `context/PRD.md`. Find §6.2's document-body sketch. Add a one-line
pointer:

> The shape below is illustrative. For the canonical document body
> structure, see `context/user-stories/20-envelope.md` §134-186.

Do not delete the §6.2 sketch — it is still useful as orientation.

### P2.9 Execute Q-AB-2: Option A — keep archived PRD, audit for orphans

Resolved on 2026-06-07: keep
`planning/archive/assembly-builder-tools/PRD.md` archived; update its
README to delegate behavior questions; audit the archived PRD for
any decisions or rationale that have not been folded into a live
`context/` doc and fold them forward as part of this phase.

The audit is the load-bearing part. Without it, "keep the archive"
becomes "the archived PRD is the only place certain decisions are
written down," which is exactly the maintainability trap Option A is
supposed to avoid. Steps:

1. **Read the archived PRD top-to-bottom**
   (`planning/archive/assembly-builder-tools/PRD.md`). For each
   section, classify the content into one of:
   - (a) Already covered by `context/user-stories/20-envelope.md` or
         one of the new docs from §P2.1-§P2.4 → no action.
   - (b) A planning artifact (phase ordering, sprint goals, risk
         tracking, status) → stays in the archive as history. No
         action.
   - (c) **A still-load-bearing product or technical decision** that
         is not captured anywhere live → fold it into the most
         appropriate context doc in this same phase. Likely landing
         zones: `envelope-commands.md`, `envelope-hbjson-export.md`,
         `envelope-thermal-preview.md`, `20-envelope.md`,
         `GLOSSARY.md`.
2. **Record the audit findings** as a brief table at the top of this
   folder's `STATUS.md` (or in a `decisions.md` in this folder if it
   grows beyond ~10 rows). Each row: "what the archived PRD said",
   "now lives in", "fold-forward action taken." This trail is the
   only way a future reader knows the archive can be safely treated
   as history.
3. **Rewrite the archived README**
   (`planning/archive/assembly-builder-tools/README.md`):
   - Remove or rewrite any sentence that calls the archived PRD "the
     product contract."
   - Add a `> **2026-06-DD**` note (use the current date when you do
     this work) saying: "This folder is historical. For current
     envelope behavior, see `context/user-stories/20-envelope.md`
     and `context/technical-requirements/envelope-*.md`. The audit
     of any rationale still load-bearing is recorded in
     `planning/features/assembly-builder-hardening/STATUS.md`."
   - Update the README's STATUS line to use the canonical
     "Superseded" status from `planning/.instructions.md`'s
     vocabulary, with a pointer to this hardening folder.
4. **Do not edit the archived PRD body.** History is read-only;
   updates land in `context/`, and the README explains the move.

Rationale for picking Option A (recorded here for traceability): the
project's existing two-zone model (`context/` for live contracts,
`planning/` for work and history) is already clear. Adding a
`context/feature-prds/` category would mean two places to look for
"what does the assembly builder do" — directly opposite to the
clarity goal. Option A also forces orphan rationale out of the
archive and into context, which is the only way `context/` stays
complete long-term.

### P2.10 `20-envelope.md` final status sweep

Phase 1 made an initial pass. After Phases 2-4 land, some sub-stories
will have verified behaviors that earlier passes left ambiguous.

Walk through the sub-stories one more time. For each:

- Status verified by tests? → mark `Merged to main` or `Complete`.
- Status still genuinely draft? → leave alone, ensure the gap is
  represented somewhere in `STATUS.md` open questions.

### P2.11 Top-level planning index

Open `planning/STATUS.md` (and `planning/README.md` if it has a feature
list). Add a one-line entry for `assembly-builder-hardening` with its
current status. Verify that no top-level index entry still points at
the May-27 review as live work.

## P3. Verification

- Render each new doc locally (or read it top-to-bottom) and check:
  - Headings are stable.
  - Code samples (if any) match what `commands/registry.py` and
    `routes.py` emit today.
  - Cross-references resolve.
- `make ci` from the repo root. Docs do not exercise code, but the
  gate catches accidental edits.
- Hand-test the "two clicks from `context/README.md` to any envelope
  contract" claim.

## P4. Risks

- **Doc drift restarts immediately.** Every doc written here will rot
  as the code evolves. Mitigation: reference shipped functions and
  routes by name, not by code excerpt; future readers should be able
  to grep from doc to code easily.
- **Over-doc.** The temptation to write a 3,000-word essay on each
  contract is real. Keep each doc tight; aim for what a new
  contributor needs to be productive, not what a textbook would
  cover.
- **Audit skipped.** The biggest risk in §P2.9 is treating the
  Option A decision as "just update a README" and skipping the
  orphan-rationale audit. The audit is the load-bearing step; if
  rationale stays only in the archive, the structure trap reopens
  the moment the next agent looks for it. Do the audit even if it
  takes longer than expected.
- **Steel-stud creep in docs.** As in Phase 2, resist the temptation
  to "just add a paragraph" on steel-stud behavior to the HBJSON
  contract doc. The only acceptable mention is the explicit deferral
  note (§P2.1 step 10).

## P5. Out of scope

- Translating any of the new docs into the user-stories format.
- Updating `ROADMAP.html` beyond what `planning/STATUS.md` implies.
- New diagrams or assets — text-only docs in this phase.
- Re-architecting `context/`'s top-level layout.
