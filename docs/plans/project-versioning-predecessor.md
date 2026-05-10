---
DATE: 2026-05-09
TIME: -
STATUS: ARCHIVED PREDECESSOR — original Project-Side Save / Versioning
        scaffold. Superseded by docs/plans/architecture-prd.md (which absorbed
        and reshaped this design). Kept for historical context only; the
        live versioning model is in the architecture PRD §§5–6. Original
        forward references (e.g. native-catalog-manager.md per Wave 3 of §3)
        are now historical — see research/poc-plans/2026-05-06-native-catalog-manager.md.
AUTHOR: Ed May (with Claude)
SCOPE: New foundational feature. PH-Navigator's transition from viewer to
       builder requires a save / revision model on project entities. This
       feature is a prerequisite for catalog version-pinning, certification
       submit-and-respond cycles, and project archival.
RELATED: docs/plans/architecture-prd.md (LIVE successor — absorbs this doc),
         research/poc-plans/2026-05-06-native-catalog-manager.md (original
         catalog manager PRD — also superseded by the architecture PRD),
         research/poc-plans/poc-evaluation.md §7.3 (catalog post-gate work
         block — partially gated on the versioning model defined here)
---

# Project-Side Save / Versioning — Initial Plan

## 1. Goal

PH-Navigator originally viewed AirTable + HBJSON data; it is becoming a
builder of project data. Today, edits to project entities (assemblies,
apertures, layers, segments, frames, glazings) mutate rows in place with no
revision history, no explicit save, and no concept of project lifecycle
state. This is fine for a viewer; it is insufficient for a builder.

This feature introduces a **save model** for project-side data so that:

1. Important moments in a project's life — certification submission, a
   certifier's feedback round, design freeze, project close — can be
   captured as **immutable revisions** that remain queryable and
   reproducible after later edits.
2. **Catalog version-pinning** (the core problem in the catalog manager
   PRD §4) has somewhere to live: each project revision serializes the
   catalog `version_id` resolved for every catalog reference at the
   moment of capture.
3. The team gains a stable answer to questions like *"what U-value did we
   submit for Project Foo's Skyline window type?"* — answered by
   resolving the relevant revision, not by trusting that the live row
   still holds its original value.
4. PHN gains a clear concept of "active editing state" vs "captured
   state" so corrections in shared resources (catalog, manufacturer
   filters, etc.) propagate sanely to active projects without retroactively
   changing closed ones.

## 2. Why this comes before the catalog manager work

Discussed in the 2026-05-09 conversation. Summary:

- The catalog manager's UC3 (closed project, vendor updates later)
  requires writing pinned `version_id` values *somewhere on the project
  side*. The existing project tables have no revision concept, so there
  is no field to write into.
- The catalog manager's UC2 (correction propagates, project can reject)
  is technically possible without project-side versioning but creates a
  worse UX: the user mid-design has the catalog change live under them
  with no notion of "I was working against this set of values until I
  saved."
- The PHN-becomes-a-builder pivot needs a save model regardless of
  catalog versioning.

The catalog editor work itself can land in parallel (Wave 1, see §3)
because it does not depend on the project-side save model. Catalog
pin-and-freeze integration (Wave 3) is what waits.

## 3. Wave structure

This document plans Wave 2. Reproduced here for context.

| Wave | Scope | Depends on |
|------|-------|------------|
| 1 | Catalog editor + identity-plus-versions schema, catalog-side audit log, soft-delete / retire. Projects continue to live-track via existing flat FKs. | nothing |
| 2 | **This doc.** Project-side save model, lifecycle states / named snapshots, working-state vs revision separation. | nothing |
| 3 | Catalog × project integration: per-reference pin, pin-on-lifecycle-transition, project-specific catalog overrides, stale-pin passive surface. | Waves 1 + 2 |

Wave 1 and Wave 2 can develop in parallel.

## 4. Non-goals (v1)

- **Branching / merge** between project revisions. Linear history only.
- **Live multi-user co-editing** with presence cursors / OT / CRDTs. Two
  users editing the same project remains last-write-wins on the working
  state (existing behavior). Concurrency safety is a v1 concern only at
  the revision-creation moment, not during editing.
- **Granular per-cell undo / redo across sessions.** That is a write-history
  concern (frontend transient stack) not a revision concern; it is what
  the catalog POC L6.2 / L6.3 lessons cover, kept session-scoped.
- **Mobile / phone optimization** of any save UX.
- **Cross-project diff / reporting.** v1 supports comparing two revisions
  within a single project, not querying across projects.
- **External revision APIs for honeybee_ph / Grasshopper / ph-dash.**
  Revision data stays server-side and is consumed via PHN's own UI in v1.

## 5. Use cases (working area — to be expanded in follow-up)

This section is the seed list to drive design decisions in §9. Each
candidate save model in §7 will be walked against these. Will be expanded
when we shift back to detailed design.

### UC1 — Active design with crash-safe auto-save
A user edits assembly thicknesses across an afternoon, expects no data
loss on browser close. *Today:* auto-save mutates DB rows. *Need:*
auto-save into a "working" state that is not a revision (revisions are
captured states), but which survives browser crashes / disconnects.

### UC2 — Capture state at certification submit
User is preparing to submit Project Foo for Phius certification round 1.
Wants to lock today's model state so the certifier's feedback can be
answered against a stable baseline, even if Ed continues editing in
parallel during the review.

### UC3 — Round-trip through certifier feedback
Project state moves: active → submitted (round 1) → active-with-feedback
→ re-submitted (round 2) → active-with-feedback-2 → re-submitted (round
3) → certified. Each submit is a captured revision. Each "active" phase
is mutable. The history of submits is reviewable.

### UC4 — Reopen a closed project
A project closed for archival generates a follow-up question 18 months
later. User reopens, may need to make changes (e.g. to respond to a code
inquiry), and re-closes. The original closure revision stays untouched;
the new closure is its own revision.

### UC5 — Compare two captured revisions
"What changed between round 1 submit and round 2 submit?" A diff view
across two revisions: which assemblies changed, which apertures, which
catalog references shifted versions, what numeric values moved.

### UC6 — Pin catalog references at capture time
When a revision is captured, every catalog FK (Material, FrameType,
GlazingType) resolves to its current `version_id` and that resolution is
serialized into the revision. After capture, vendor reformulations of
catalog rows do not affect the captured revision.

### UC7 — Project-specific override of a catalog value
User wants Walltite ECO in Project Foo to use a slightly different
conductivity than the catalog says (contractor's SDS differs). Stored as
a thin override scoped to the project (and, post-capture, to the captured
revision). Catalog row stays clean.

### UC8 — Project copy / template
Start a new project from an existing project's revision. Inherits the
captured catalog `version_id` references at that moment; user can detach
and live-track on a per-reference basis afterward.

### UC9 — Concurrent editing safety at capture
Ed and John both have Project Foo open. Ed clicks "Submit for round 1"
while John is mid-edit on an assembly. The capture must produce a
self-consistent snapshot (no half-saved values), and John's mid-edit
must not silently disappear.

### UC10 — Recover from a bad edit session
User makes a series of changes today, comes in tomorrow, decides the
whole session was wrong. Want to revert to yesterday's last revision.
*Open question:* is "revert to revision X" a v1 feature, or is "view
revision X read-only and re-create the values manually" sufficient for
v1?

### UC11 — Auto-revision on long idle
*Open question:* should the system automatically capture a revision after
a long quiet period (no edits for a day, week)? Cheap insurance against
"I forgot to capture before I changed everything" but adds noise to the
revision timeline.

### UC12 — Catalog edit during active project session
A live-tracking project is open in the browser. Catalog editor (in
another tab, by Ed or John) fixes a typo in a Material the project uses.
*Open question:* does the project's open browser tab silently update? On
next refresh? Or does the working state freeze its catalog reads at
session start? This affects how UC2 of the catalog PRD is implemented in
practice.

## 6. Project entity scope

The project state subject to revision includes the existing entity tree
rooted at `Project`:

```
Project
├── assemblies         → Assembly
│   └── layers         → Layer
│       └── segments   → Segment
│           ├── material         (FK → assembly_materials.id)
│           ├── material_photos
│           └── material_datasheets
├── apertures          → Aperture
│   └── elements       → ApertureElement
│       ├── frame      → ApertureElementFrame
│       │   └── frame_type    (FK → aperture_frame_types.id)
│       └── glazing    → ApertureElementGlazing
│           └── glazing_type  (FK → aperture_glazing_types.id)
└── manufacturer_filters
```

Out of scope of v1 revision capture (revisit case-by-case):

- `airtable_base` linkage and any AirTable-side data. Revisions are PHN-
  local.
- User membership (`project_users`). Revisions capture the project's
  *technical* state, not its access control.
- Photos and datasheets — these are object-storage references. Revisions
  capture the URL pointers; the underlying objects in storage are
  considered immutable by convention (we do not overwrite an existing
  photo URL with new bytes).

## 7. Candidate save models

Four candidate models. Each is described in terms of *user mental model*,
*data model*, and how it answers the §5 use cases.

### Model A — Auto-save + lifecycle states

**Mental model.** The project has an explicit lifecycle: `active`,
`submitted`, `closed`. Edits are auto-saved into the working state. State
transitions (active → submitted, submitted → closed, closed → reopened)
are explicit user gestures and each transition captures a revision.

**Data model.**
- Existing entity tables (`assemblies`, `apertures`, …) hold the *working
  state* — mutable, last-write-wins, the live data path.
- `project_revisions` table — one row per captured revision.
- A frozen *snapshot blob* per revision (one JSONB column or a
  side-payload table) holds the entire project's state at capture.
- `Project.lifecycle_state` column — current state in the FSM.
- `Project.current_revision_id` — denormalized pointer to the most
  recent captured revision (for "what was the state at the last
  submit").

**Lifecycle FSM (v1 proposal):**
```
active ─submit─→ submitted ─reopen─→ active
   │                  │
   │                  └─close──→ closed ─reopen─→ active
   │
   └─close (skip submit)──→ closed ─reopen─→ active
```

**Pros.**
- Matches BLDGTYP's actual workflow — design analysis, certification
  submit, certifier rounds, close.
- Zero ceremony for day-to-day editing (auto-save status quo).
- Revisions correspond to *meaningful project events*, not arbitrary
  user gestures.

**Cons.**
- No "save my state right now" gesture outside lifecycle transitions.
  If a user wants to mark a working-in-progress moment without changing
  state, they can't.
- No within-state rollback (UC10 has no v1 answer).

**Use-case coverage.** Strong on UC2, UC3, UC4. Weak on UC10.

### Model B — Auto-save + named snapshots on demand

**Mental model.** Edits auto-save into working state. User can click
"Take a snapshot" at any time, supplying a label. Snapshots are frozen
copies of project state. No lifecycle states.

**Data model.**
- Same working-state path as Model A.
- `project_revisions` table identical, all revisions are kind=`snapshot`.
- No `lifecycle_state` column.

**Pros.**
- Simplest implementation.
- Total user control of when revisions are created.
- Familiar (Google Docs-style version history).

**Cons.**
- Requires user discipline. Forget to snapshot before a destructive edit
  → that state is lost.
- No structured representation of certification rounds. "Submitted for
  round 1" is just a label the user might or might not type.
- The catalog pin-on-close mechanism (the original motivation) has no
  place to attach. Closing a project would have to be implemented as
  "snapshot + something else" anyway.

**Use-case coverage.** OK on UC2 (if user remembers). Weak on UC3
(certification rounds are unstructured). Weak on UC6 (no obvious "close"
moment to pin).

### Model C — Auto-save + lifecycle states + named snapshots

**Mental model.** Combines A and B. Lifecycle states drive the
certification workflow; named snapshots cover the "I want to save right
now without changing state" gap.

**Data model.**
- `project_revisions.kind ∈ {'lifecycle', 'snapshot'}`.
- `project_revisions.lifecycle_event` populated only on `kind='lifecycle'`.
- All other columns identical.

**Pros.**
- Strongest coverage of §5 use cases.
- The two mechanisms are orthogonal — lifecycle is structural, snapshots
  are user-controlled marking.

**Cons.**
- Two save concepts to explain to users. Risk that "is this a snapshot or
  a lifecycle transition?" becomes confusing.
- More UI surface (lifecycle transition button + snapshot button).

**Use-case coverage.** Strongest overall.

### Model D — Git-like commit log

**Mental model.** Edits accumulate in a working tree. User commits to
record a labeled snapshot. Linear history. "Submit" is a kind of commit.
"Close" is a kind of commit. "Just save this state" is a commit.

**Data model.**
- Single `project_revisions` table; every revision is a commit.
- Optional `commit_kind` (lifecycle / snapshot / auto) for filtering.

**Pros.**
- Most powerful and most uniform. One concept covers everything.
- Maps cleanly to UC10 (revert to commit X).
- Familiar to engineers.

**Cons.**
- Architects, energy modelers, and certification consultants are not git
  users. The commit metaphor is alien.
- "Did I commit?" anxiety — same failure mode as Model B but worse,
  because committing is the *only* way to preserve state.

**Use-case coverage.** All of §5 if user discipline is high. Real-world
risk: low user discipline.

### Recommendation

**Model C** (auto-save + lifecycle states + named snapshots).

Rationale: lifecycle states give the certification workflow a structural
home and unblock the catalog pin-on-close mechanism without ceremony.
Named snapshots cover the "I want to mark this moment" gap that pure
lifecycle states leave (UC10). Auto-save underneath keeps day-to-day
editing zero-friction.

The two-concept cost is real but manageable: lifecycle transitions go
through dedicated UI (a "Submit for review" button at a project-level
location, not in the assembly editor), while snapshots live in a single
"Take snapshot" affordance in the project header.

Open in §9: whether v1 ships *both* concepts or starts with lifecycle-only
and adds snapshots once that pattern is bedded in. My lean: ship both,
but make snapshots discoverable and lightweight rather than a primary
gesture.

## 8. Data model sketch (v1 working proposal)

Subject to revision based on §7 final choice and §9 open questions.

### 8.1 Working state — unchanged

The existing entity tables (`projects`, `assemblies`, `assembly_layers`,
`assembly_layer_segments`, `apertures`, `aperture_elements`,
`aperture_element_frame`, `aperture_element_glazing`,
`project_manufacturer_filters`) continue to hold the **mutable working
state** of a project. No schema change to the working tables for v1.

This is important: external consumers (frontend reads, future GH /
honeybee_ph integrations) keep reading the same tables they read today.
Versioning is *additive*.

### 8.2 New tables

```sql
-- One row per captured revision of a project.
project_revisions (
    id                   UUID PRIMARY KEY,
    project_id           INTEGER NOT NULL REFERENCES projects(id),
    kind                 TEXT NOT NULL,
                         -- 'lifecycle' | 'snapshot' | 'auto' (reserved)
    lifecycle_event      TEXT,
                         -- 'submitted' | 'closed' | 'reopened' | NULL
                         -- NULL when kind != 'lifecycle'
    label                TEXT,
                         -- user-facing name; required for kind='snapshot',
                         -- auto-generated for kind='lifecycle'
    notes                TEXT,
    parent_revision_id   UUID REFERENCES project_revisions(id),
                         -- linear chain; NULL only for the project's first
                         -- revision
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by           INTEGER NOT NULL REFERENCES users(id),
    INDEX (project_id, created_at)
);

-- One row per revision; holds the frozen project state.
-- Separated from project_revisions to keep the metadata table lean.
project_revision_snapshots (
    revision_id          UUID PRIMARY KEY REFERENCES project_revisions(id),
    payload              JSONB NOT NULL,
                         -- full serialized project state — see §8.4
    payload_schema_version  INTEGER NOT NULL,
                         -- bumps when the serialization shape changes
    payload_size_bytes   INTEGER NOT NULL
                         -- denormalized for ops visibility
);
```

### 8.3 New columns on `projects`

```sql
ALTER TABLE projects ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'active';
                            -- 'active' | 'submitted' | 'closed'
ALTER TABLE projects ADD COLUMN current_revision_id UUID
                            REFERENCES project_revisions(id);
                            -- denormalized: the most recent captured revision.
                            -- NULL until first revision is captured.
ALTER TABLE projects ADD COLUMN lifecycle_state_changed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN lifecycle_state_changed_by INTEGER
                            REFERENCES users(id);
```

### 8.4 Snapshot payload shape (v1 sketch)

A single JSONB blob per revision. Round-trippable: a snapshot can in
principle reconstruct the project's working state in another database.

```json
{
  "schema_version": 1,
  "captured_at": "2026-05-09T14:23:00Z",
  "captured_by": 42,
  "project": {
    "id": 17,
    "name": "PROJECT FOO",
    "bt_number": "2024-013",
    "phius_number": "PHIUS-2024-0445",
    "phius_dropbox_url": "..."
  },
  "manufacturer_filters": [ ... ],
  "assemblies": [
    {
      "id": 88,
      "name": "Wall A",
      "layers": [
        {
          "id": 201,
          "order": 0,
          "segments": [
            {
              "id": 9001,
              "order": 0,
              "width_mm": 50.0,
              "is_continuous_insulation": true,
              "specification_status": "complete",
              "notes": null,
              "material": {
                "catalog_id": "recAbcDef123",
                "catalog_version_id": "ver_2024-08-01_001",
                "resolved_values": { ... },
                "overrides": { "conductivity_w_mk": 0.034 }
              }
            }
          ]
        }
      ]
    }
  ],
  "apertures": [ ... ]
}
```

Key properties of the payload:

- **Catalog references resolved at capture time.** Every FK to a
  catalog table writes both `catalog_id` (the identity row) and
  `catalog_version_id` (the resolved version). After capture, the
  revision is independent of catalog mutation.
- **Resolved values inlined.** The catalog version's actual field values
  at capture time are inlined under `resolved_values`. This is
  redundant with `catalog_version_id` (you could re-resolve), but
  makes the snapshot self-contained — readable even if the catalog
  version row were ever lost.
- **Project-specific overrides** (UC7) ride on the same node.
- **`schema_version: 1`** lets us evolve the format. Old revisions stay
  readable through a migration / shim layer; we never edit them in place.

### 8.5 Why JSONB blob per revision rather than parallel snapshot tables

Considered alternatives:

- *Parallel snapshot tables* (one per entity type, with `revision_id`
  FK). Pro: queryable by SQL across revisions. Con: large schema
  duplication, every entity-table change requires a snapshot-table
  change, complex foreign-key plumbing.
- *Event sourcing* (don't snapshot; replay events). Pro: cleanest.
  Con: every read of an old revision is a replay; conceptually heavy;
  events have no natural place in the existing architecture.
- *JSONB blob* (chosen). Pro: simple insert, simple read, schema
  evolution via `schema_version`, self-contained. Con: not natively
  SQL-queryable; cross-revision queries (UC5 diff) happen in the
  application layer.

For BLDGTYP scale (dozens of projects, ~5–20 revisions each), the JSONB
blob path is right. If we later want analytics across revisions, build
materialized views off the blobs.

### 8.6 Capture transaction

Capturing a revision is a single transaction:

1. Acquire an advisory lock on the project (prevents two concurrent
   captures and detects in-flight working-state writes — see UC9).
2. Read the project's full working-state tree.
3. Resolve every catalog FK to its current `version_id` and inline the
   `resolved_values` from the catalog version row.
4. Apply project-specific overrides (UC7).
5. Insert one row into `project_revisions` and one into
   `project_revision_snapshots`.
6. Update `projects.current_revision_id`.
7. If lifecycle transition: update `projects.lifecycle_state`,
   `*_changed_at`, `*_changed_by`.
8. Release the lock.

The lock is held only for the duration of the capture (sub-second at
typical scale). Working-state writes during a capture are queued or
return a transient 409.

## 9. Open design decisions (working area)

Each will be resolved before implementation. To be discussed in follow-up
conversations.

1. **Save model: A vs C.** §7 recommends C; ship lifecycle + snapshots
   together, or ship lifecycle-only first?
2. **Lifecycle states — what set?** Proposed: `active` / `submitted` /
   `closed`. Should we model certification rounds explicitly
   (`submitted_round_1`, `submitted_round_2`)? Or keep it simple and
   let the user record round number in the revision label?
3. **Reopen semantics.** When a `closed` project is reopened, what is
   the `lifecycle_state`? Back to `active`? A new state `reopened`?
4. **Snapshot vs lifecycle frequency.** Should we cap revision count
   per project, or retain unbounded? At what point do auto-snapshots
   on long idle (UC11) become more noise than signal?
5. **Catalog read freshness during a session (UC12).** When a
   live-tracking project is open and the catalog mutates in another
   tab, does the open session refresh on next read, or freeze its
   catalog reads at session start? Affects mid-design surprise.
6. **Diff view (UC5) in v1 or follow-up?** Substantial UI work.
   Possibly defer to a follow-up after the core capture model is
   bedded in.
7. **Revert to revision (UC10) in v1 or follow-up?** Mechanically:
   replay a revision's payload back into working-state tables. The
   replay logic is non-trivial because schema may have evolved since
   capture (handled via `payload_schema_version` shims).
8. **Auto-save granularity.** Existing PHN auto-saves on every cell
   blur. Working state remains the same. *Open:* should there be a
   "discard working changes since last revision" gesture? If yes,
   what's the UX?
9. **Working-state crash recovery.** Existing behavior — DB row holds
   the value, no recovery needed. Confirm this is sufficient and we
   don't need a separate "in-flight edit" buffer.
10. **Concurrency at capture (UC9).** The proposed advisory lock
    serializes captures. Open: how does the UI communicate "another
    user just captured a revision; your in-progress edits are now
    against a different baseline"?
11. **Multi-project scope.** Captured revisions are per-project.
    Confirm there is no cross-project linkage to consider (e.g.,
    shared assemblies between projects). My read: assemblies are
    project-scoped (`assemblies.project_id`), so no cross-project
    issue.
12. **Storage / cost.** JSONB payload for a typical PHN project: rough
    estimate ~50–500 KB serialized. At ~20 revisions per project ×
    50 projects = ~500 MB total over the lifetime of PHN. Trivial,
    but worth budgeting consciously and adding a `payload_size_bytes`
    column for monitoring.

## 10. API sketch (v1)

To be fleshed out after §9 decisions land. Indicative shape:

```
POST   /api/projects/{id}/revisions          # capture a snapshot or lifecycle revision
GET    /api/projects/{id}/revisions          # list revisions
GET    /api/projects/{id}/revisions/{rev_id} # read a captured revision
GET    /api/projects/{id}/state              # current lifecycle_state + current_revision_id
POST   /api/projects/{id}/state-transitions  # request a lifecycle transition (also captures)
DELETE /api/projects/{id}/revisions/{rev_id} # soft-delete a captured revision
                                             # (audit-logged; payload retained)
POST   /api/projects/{id}/revisions/{rev_id}/revert  # (gated on §9 #7)
```

Reads of "current" project state continue to use the existing endpoints
on the working tables. Revisions are an additive read path, not a
replacement.

## 11. Migration plan

Existing projects have no revisions. On deploy:

1. Add the new schema (`project_revisions`, `project_revision_snapshots`,
   `projects.lifecycle_state` column, etc.) via Alembic migration.
2. Set `projects.lifecycle_state` to `active` for all existing projects.
3. **Do not auto-synthesize a "v0 — initial state" revision.** Existing
   projects start with no captured revision. If a user wants to mark
   today's state, they take a snapshot or transition to submitted /
   closed.
4. Existing FK references (e.g. `Segment.material_id`) stay as-is.
   Nothing in the working schema changes.

This makes the deploy boring — schema additions only, no data backfill,
no risk to existing reads.

## 12. Risks

- **Scope creep.** This is a foundational feature; tempting to keep
  adding ("what about per-user preferences? what about audit log on
  every working-state edit?"). Defer aggressively. v1 captures the
  *project state at meaningful moments*; everything else is follow-up.
- **Data model commitment.** Once revisions are in production, schema
  changes to the *payload* shape become hard. Mitigation: explicit
  `payload_schema_version` from day one and a tested migration / shim
  path exercised before the first real revision is captured.
- **UX risk on lifecycle transitions.** Certification submit / close are
  high-stakes user actions. Confirm modals must clearly state what is
  about to happen and what is reversible.
- **Mismatch with how users mentally model "save".** The proposal in §7
  is auto-save + occasional explicit capture. If users expect a Word-style
  "save" gesture on every change, the model feels wrong. Worth
  validating with John before building.
- **Revision payload bloat.** If we accidentally serialize transient
  data (e.g. UI session state) into the snapshot, payload size balloons.
  Strict allow-list on what serializes, asserted in tests.

## 13. Cost & ops

- **Postgres storage.** §9 #12 estimate ~500 MB lifetime. Negligible on
  Render's standard tiers.
- **Compute.** Capture is a single read of working state + a single
  insert. Sub-second at typical scale.
- **Backup.** Captured revisions are part of normal `pg_dump` flow. The
  catalog manager PRD §7 backup pattern (nightly dump → R2) covers
  this once that work lands.

## 14. Success criteria

- All existing project edits continue to work without behavior change in
  `active` state.
- A user can submit, reopen, and close a project, and each transition
  is captured as a revision.
- A user can take a named snapshot at any time in `active` state.
- Reading a captured revision returns the project state as it was at
  capture time, *including* catalog values resolved at that moment.
- A captured revision is not affected by subsequent edits to the
  working state, the catalog, or anything else.
- Total deploy is additive — no schema changes to existing entity
  tables, no migration of existing project data.

## 15. Out-of-scope reminders (for visibility)

- Real-time collaboration (CRDTs, presence cursors).
- Branching / merging revisions.
- Cross-project queries against revision payloads.
- Mobile UX.
- Public revision API for honeybee_ph / Grasshopper consumers.
- Per-cell audit log on working-state edits (separate concern; may live
  alongside but is not gated on this feature).

## 16. Next steps

1. **Working-conversation pass through §5 use cases** with John, expanding
   each to a concrete user flow. May surface gaps in §9 open decisions.
2. **Resolve §9 decisions** in priority order: 1, 2, 3, 5 first (these
   shape the data model); 6, 7 later (UI scope).
3. **Schema migration draft.** Alembic file landing the §8 changes.
4. **Backend service skeleton.** `backend/features/project_versioning/`
   with `services/capture.py`, `services/replay.py`, routes.
5. **Frontend skeleton.** Lifecycle-state badge in project header,
   "Submit / Close / Reopen" actions, "Take snapshot" affordance,
   revision-list panel.
6. **Once core capture model lands**, return to the catalog manager PRD
   and sequence Wave 3 (catalog × project pinning integration).
