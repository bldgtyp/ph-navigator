---
DATE: 2026-07-18
TIME: 16:10
STATUS: Complete / settled and archived
AUTHOR: Ed May (with Claude)
SCOPE: Product/UX contract for project-wide site photos (equipment photos + contractor-facing directions page)
RELATED: README.md, research.md, planning/features_v1.1/contributor-auth/,
         context/user-stories/20-envelope.md (US-ENV-15), context/UI_UX.md §1.8,
         context/ui/pages/status-tab.md, context/technical-requirements/attachments.md
---

# Documentation tab — PRD (design draft; feature formerly named "site-photos")

## 1. User stories

- **US-SP-1 (designer logs a photo).** Ed or John receives a photo from the
  contractor (email/text) and attaches it to the correct equipment record
  (pump, fan, ventilator, …) the same way they attach a datasheet today.
- **US-SP-3 (contractor sees what's needed).** A contractor opens the public
  project URL, lands on a Site Photos page, and sees: clear per-record
  directions (what to shoot, "include a ruler", example images), which exact
  record each required photo belongs to (Ventilator-ABC-123 vs
  Ventilator-GGG-456), and a done/missing overview.
- **US-SP-2 (team member uploads)** — split out; see
  `planning/features_v1.1/contributor-auth/`. Deliberately **not** a dependency of
  this feature: US-SP-1 + US-SP-3 ship on the current auth model (editors
  upload, anonymous viewers read).

## 2. Scope

**In:** `photo_asset_ids` on all equipment tables (ventilators, heat-pump ×4,
pumps, fans, hot-water heaters, hot-water tanks, electric heaters,
appliances) **plus apertures (frames/glazings) and thermal bridges**
(2026-07-18 — interpretation of Ed's multi-select, confirm in decisions.md);
photo columns in the owning DataTables/report panels; a whole-project Site
Photos surface with directions content and done/missing rollup; done/missing
derivation rules; HEIC accept + server-side JPEG conversion.

**Out (this feature):** contributor auth (deferred to v1.1); per-photo
structured metadata beyond what the asset row already carries (§D3); moving
photo storage out of the versioned document (§D6 discusses, defers);
per-project directions overrides (§D4 deferred).

## 3. Design principle — "two views, one dataset" (resolves the duplication worry)

The app already answers Ed's "is duplicating in both places bad?" question
twice:

- The **Status tab** is a read-only projection of 15 record tables; edits
  stay on the owning surface; rows deep-link back (`focus={row_id}`).
- **US-ENV-15** explicitly rules the envelope Site Photos sub-tab is "purely
  a presentation-layer reorganization of existing data … a different view of
  the same data, with the same write affordances."

So the rule for this feature: **records are edited only on their owning
surface; photo/datasheet attach–detach is allowed from any surface that shows
the record; both surfaces read and write the same `photo_asset_ids` arrays in
the document.** There is no second copy of anything — no sync problem, no
divergence. "Duplication" here is the same healthy pattern a spreadsheet's
pivot table has to its source rows.

## 4. Open design decisions (work through with Ed, in order)

### D1. Where does the whole-project Site Photos surface live? — ✅ DECIDED 2026-07-18: Option A

| Option | Shape | Notes |
|---|---|---|
| **A — top-level project tab** (recommended) | `Site Photos` becomes a project tab (peer of Status/Apertures/Envelope/Equipment), route `/projects/{id}/site-photos`, with anchored sections: Envelope (by assembly type per US-ENV-15) → Equipment (by table) → future sections. | One URL to text a contractor. Whole-project overview matches Story 3. Supersedes the US-ENV-15 sub-tab (the envelope section of this page IS that design, absorbed). |
| B — per-section sub-tabs only | Build US-ENV-15 as specced under Envelope + add a sibling `equipment/site-photos`. | Photos stay proximate, but the contractor needs two URLs and never gets a whole-project view; Story 3 fails its "clear overview of the ENTIRE project" bar. |
| C — top-level tab AND keep the envelope sub-tab | Both surfaces render the shared envelope section. | Max flexibility, but two routes showing the same thing invites drift and confuses "which link do I send". |

**Decided: A** (Ed, 2026-07-18). Amend US-ENV-15 to point here (its section
design — grouping, anchor links, per-assembly cards, na-exemption — carries
over verbatim as the page's Envelope section). **Still open:** whether the
envelope sub-tab slot is dropped from the envelope tab bar or kept as a
redirect to `/site-photos#envelope`.

Regardless of D1: equipment tables get a proximate photo column (like
datasheets today), and the Materials sub-tab keeps its per-segment photo
zones — the "data proximate to use" half of Ed's instinct is preserved
everywhere.

### D2. Page composition — ✅ FINAL 2026-07-18 (wireframe v2.1 is the visual contract)

**`assets/wireframe.html` (v2.1) is the agreed composition.** Summary of
the final grammar (decisions.md sessions 2–5):

- **Unified 3-column row grid in every section:** each record row =
  `Record (Display Name + sub-label) · Spec · Photos · Datasheet`.
  - Spec: the stored `Specification Status` select (editors) / text chip
    (viewers). Same field as the owning table's renamed column.
  - Photos: thumbnail strip + drag-drop `+` zone (editors) via the shared
    `AttachmentCell`; "Photo needed" dashed state when empty; muted
    "not required ✓" when waived.
  - Datasheet: read-only count chip (click = preview); "📄 Missing" dashed
    state; waived state as above. Upload/manage stays on owning surfaces
    in v1.
  - Photos and Datasheet cells each carry an **editor-only inline
    "not required" checkbox** (the per-axis waiver).
- **Sections:** Envelope (Walls / Floors / Roofs / Other) → Equipment
  (Ventilators; Heat Pumps with leaf sub-heads; Pumps; Fans; Hot Water;
  Electric Heaters; Appliances) → Apertures (Frames & Glazings) → Thermal
  Bridges. Sticky section headers with counts, a "📖 How to photograph — X"
  button, and an anchor-copy 🔗 link. Fully-complete sections may render
  as collapsed one-line stubs.
- **Envelope rows are assembly-primary, material-deduped:** one row per
  unique material per assembly ("used in N segments"); photo uploads fan
  out to all of that material's segments in that assembly (Materials-page
  use-site grouping). The **Datasheet cell is a material-level projection**
  (one array per ProjectMaterial, project-wide — labeled "shared
  project-wide"); supplying it from any row updates every assembly using
  that material instantly. Datasheet waiver is material-level; photo waiver
  is per material×assembly.
- **Directions are per-category, on demand:** each section's 📖 button
  opens a modal with that category's explicit numbered shot list +
  example images. Never expanded by default. Content is deliberately
  exact ("nameplate with model + serial legible", "ruler in frame") —
  field crews want zero ambiguity.
- **Record-detail modal:** click a record name → read-only attribute
  projection + datasheets + photos (certifier-review use). Per-table
  attribute lists are chosen at implementation (start: identity fields +
  the table's primary spec fields + notes).
- **Header:** three-chip rollup (`Spec N/M · Datasheets N/M · Photos N/M`),
  per-axis "missing" filter chips, version line + editor unsaved-changes
  hint.
- **Viewer rendering** (anonymous contractor/certifier): selects, drop
  zones, and waiver checkboxes absent; thumbnails, chips, lightbox, 📖
  directions, and the record modal remain. Card/list layout must stay
  phone-usable.

Original v1 sketch superseded by the wireframe file; kept below only for
the header/rollup blocking reference:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Site Photos                                    12 of 31 records ✓   │
│  [All sections ▾] [Missing only ⬜]              19 need photos       │
├──────────────────────────────────────────────────────────────────────┤
│  ▸ How to take these photos                    [expand/collapse]     │
│    (directions blocks w/ example images — §D4; collapsed by default  │
│     for returning visitors, expanded on first visit)                 │
├──────────────────────────────────────────────────────────────────────┤
│  Envelope — Walls (3 assemblies · 24 photos)  🔗          [#walls]   │
│    WALL-C3   [mini section strip]                                    │
│      Layer 2 · Seg 1 · XPS          [📷][📷][+]                      │
│      Layer 3 · Seg 1 · Gypsum       [ Photo Needed ]                 │
│  Envelope — Floors …  · Roofs …                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Equipment — Ventilators (2 records)  🔗                             │
│    ┌────────────────────────────────────────────────────────────┐    │
│    │ ERV-01 · Zehnder CA 350        status: Complete            │    │
│    │   Required: nameplate · installed-in-place · duct conns    │    │
│    │   [📷][📷][+]                                              │    │
│    ├────────────────────────────────────────────────────────────┤    │
│    │ ERV-02 · Zehnder CA 200        status: Needed              │    │
│    │   [ Photos Needed — see directions ]                       │    │
│    └────────────────────────────────────────────────────────────┘    │
│  Equipment — Heat Pumps … Pumps … Fans … DHW … Appliances …          │
└──────────────────────────────────────────────────────────────────────┘
```

- Card/list layout, **not** DataTable — this page must read well on a phone
  on a job site (DataTables are desktop-dense; §1.8 evidence chips + the
  report-status-chip filter pattern apply).
- Record identity is prominent (name/tag + manufacturer/model) so the
  contractor can tell ERV-01 from ERV-02 — Story 3's core ask.
- Sticky section headers + `🔗` anchor-copy links (US-ENV-15 criterion 4).
- Summary + "Missing only" filter chip at top (evidence grammar §1.8:
  missing must be filterable; missing links to the surface that resolves it).
- Editors additionally get drag-drop upload zones inline (same
  `AttachmentCell`); viewers see thumbnails + lightbox only.

### D3. Equipment photo data model

**Recommendation:** plain `photo_asset_ids: list[str]` per row, exactly
mirroring `datasheet_asset_ids` (registry: `site_photo` kind, max 10, 25 MB,
png/jpeg/webp). Required shots are expressed as *directions content* (§D4),
not as structured per-photo slots — matching how Materials/segments work
today and keeping the schema boring.

Rejected-for-now alternative: typed photo slots per record kind (nameplate /
installed / connections) with per-slot done-ness. More precise rollups, but
adds a schema concept the rest of the app doesn't have; revisit only if
"≥1 photo = done" proves too loose in practice (§D5).

**Sub-decisions:** (a) ✅ Apertures (frames/glazings) and Thermal Bridges
join equipment in v1 (2026-07-18 — interpretation to confirm, decisions.md).
(b) ✅ HEIC: accept + convert to JPEG server-side at complete-upload
(pillow-heif or similar; thumbnailer consumes the converted JPEG)
(2026-07-18).

### D4. Directions / template content — where does it live? — ✅ DECIDED 2026-07-18: Option A (static in-repo)

| Option | Model | Notes |
|---|---|---|
| **A — static app content** (recommended for v1) | Directions blocks + example images ship with the frontend (V0 precedent). Same for every project. Curated by BLDGTYP in-repo. | Zero backend; content is BLDGTYP's own photos (public-repo safe — verify each image). Iterate by PR. |
| B — global content + per-project overrides | A per-project "photo notes" rich-text field layered on the static blocks. | Adds an editable surface; defer until a project actually needs custom directions. |
| C — fully per-project CMS-ish content | Editors author directions per project. | Overkill for a 2-person shop; rejected. |

Directions structure (from V0): one block per *record family* (Floor / Wall /
Roof assemblies; then per equipment kind: Ventilators, Heat Pumps, Pumps,
Fans, DHW, Electric Heaters, Appliances), each block = requirement cards of
instruction bullets + example image ("include a ruler", "photograph the
nameplate", "show duct connections before insulating").

### D5. Per-record documentation state — ✅ DECIDED 2026-07-18 (points 1–5 below accepted; see decisions.md session 3)

Ed's reframe: a record has **three independent documentation axes** —
*specification* ("the team has committed to product X"), *datasheet* ("we
have the submittal data"), *photo* ("we have the installed evidence") — and
"Complete spec, missing submittal" is a common real state the single
`status` field can't express.

Direction under discussion (see decisions.md session 2):

1. **Rename, don't add, in the DataTables:** the equipment `Status` column
   renames to `Specification Status` (envelope/apertures already literally
   use `specification_status` — equipment's generic name is the outlier).
   No datasheet/photo status columns are added to the tables.
2. **Derive, don't store, the datasheet and photo axes:** ≥1 attachment =
   have-it. Auto-true on upload — no manual bookkeeping, can't go stale.
3. **Per-axis N/A waivers (proposed):** small stored per-record flags
   ("datasheet not required" / "photo not required") for records where an
   axis genuinely doesn't apply; set only from the evidence page / record
   modal, never shown in the DataTable. Record-level `specification_status
   = na` still implies all axes N/A (Q-ENV-13.3 parity).
4. **Where set:** specification status is settable from BOTH the owning
   DataTable (renamed column) and the evidence-page record card (Materials-
   card precedent) — same field, two surfaces, per §3. Not exclusively
   moved to the evidence page (proximity while editing records matters).
5. **Rollup:** three chips — `Spec N/M · Datasheets N/M · Photos N/M` —
   per section and whole page; "missing" filter per axis.

Not modeled (deliberately): per-axis "question/rejected" states — a wrong
datasheet stays `specification_status = question` + notes, as today.
Revisit only if practice demands it.

**Accepted 2026-07-18** (derived axes + waivers, rename, dual-surface).
Remaining for phase planning: the rename mechanics (column display-name
change vs `status` field-key migration).

### D6. Draft-vs-saved visibility (edge case that shapes the workflow)

Photos live inside the versioned document, and attach writes go to the
editor's **draft**. Consequences: (1) after Ed attaches photos he must
**Save** before contractors (anonymous viewers, who read the last saved
version) see progress; (2) an unsaved draft shows Ed a different done/missing
picture than visitors see.

**✅ DECIDED 2026-07-18:** accept, and make it visible — the page shows
editors the standard unsaved-draft indicator plus a hint on the rollup
("includes unsaved changes — Save to publish"). No auto-save on attach;
identical behavior to Envelope/Materials today.

**Flagged for contributor-auth:** this same mechanic is much more awkward for
upload-only contributors (whose uploads would sit in a draft they cannot
save). The long-term alternative — moving photo/datasheet evidence to
project-level storage like Airtightness ("project-level, not tied to a
version") — is a real option but a significant migration; it is contributor-
auth's central design question, not this feature's.

## 5. Edge cases (checklist for phase plans)

- `na`-status records: photo zones disabled/exempt (Q-ENV-13.3 parity).
- Locked versions & viewers: thumbnails + lightbox render; all upload/delete
  affordances hidden (§1.8; Materials locked-rendering parity).
- Heat pumps: 4 leaf tables — group as one "Heat Pumps" section with leaf
  sub-heads (mirror status-summary's disclosure).
- Row duplication: attachment columns are excluded from DataTable
  duplication today — verify the new photo column inherits that.
- Deleted rows / Save-As: asset ids remain valid in older versions;
  reference-aware GC already handles purge — no new work, but test.
- Record renamed between contractor visits: page keys on record id; display
  name changes are cosmetic.
- Empty project / no equipment yet: empty-state card per US-ENV-15 criterion
  2 (viewer variant without editor CTA).
- Mobile: page must be usable on a phone (cards, large tap targets,
  lightbox); uploads from phone camera roll for editors.
- EXIF orientation: handled by the existing thumbnailer (verified).
- HEIC uploads: see §D3(b) — currently rejected by MIME allow-list.
- Version picker: viewers see the selected saved version's photos (status-tab
  parity); the page states which version it reflects.

## 6. Explicitly NOT in this feature

- Any new auth surface, upload tokens, or contributor roles → contributor-auth.
- Photo annotation/markup, comments, EXIF-GPS display.
- Notifications ("new photo uploaded") — candidate for contributor-auth v2.
- AI photo-validation ("is there a ruler in this shot?") — fun, later.

## 7. Future scope (logged 2026-07-18, deliberately not v1)

- **Project Documents section:** blower-door test reports, ventilation
  commissioning reports, and similar *project-scoped* (not per-record)
  documents conceptually belong on the Documentation page too. Distinct
  storage class from per-record evidence — likely project-level and
  non-versioned, like the Airtightness tab's data (whose test-report PDF is
  the obvious first tenant). Design when a real project needs it.
- **Status-tab echo:** the record-status projection could show the same
  three per-group chips (Spec / Datasheets / Photos) for a project-wide
  "what do we owe the certifier" view.
