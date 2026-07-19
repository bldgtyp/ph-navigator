---
DATE: 2026-07-18
TIME: 16:30
STATUS: Complete / archived decision log
AUTHOR: Ed May (with Claude)
SCOPE: Accepted / rejected decisions for site-photos
RELATED: PRD.md, STATUS.md
---

# Site Photos — decisions

## 2026-07-18 (design session 1)

- **D1 Placement — ACCEPTED Option A:** whole-project surface is a new
  **top-level project tab** `Site Photos` (`/projects/{id}/site-photos`),
  peer of Status/Apertures/Envelope/Equipment. Absorbs US-ENV-15 (its
  envelope section design carries over). Equipment tables still get
  proximate photo columns; Materials keeps per-segment zones.
  *Open sub-point:* whether the envelope `Site Photos` sub-tab slot is
  dropped from the envelope tab bar or kept as a redirect to
  `/site-photos#envelope`.
- **v1 record-family scope — ALL FAMILIES (interpretation to confirm):**
  Ed's multi-select included Apertures and Thermal Bridges alongside
  "equipment only", which is contradictory; interpreted as **equipment +
  apertures (frames/glazings) + thermal bridges all in v1**. Confirm before
  phase planning.
- **D4 Directions content — ACCEPTED static in-repo** (V0 precedent):
  directions blocks + BLDGTYP-owned example images ship with the frontend;
  same for all projects; iterate by PR. Per-project notes deferred.
- **HEIC — ACCEPTED accept + convert server-side:** add HEIC/HEIF to the
  photo allow-list; convert to JPEG at complete-upload (pillow-heif or
  similar); thumbnail pipeline consumes the converted JPEG.
- **Contributor auth (US-SP-2) — DEFERRED to v1.1:** folder moved to
  `planning/features_v1.1/contributor-auth/`. CompanyCam guest-access
  precedent flagged as the resume thread. v1 UI/UX targets Ed + John
  (editors) and anonymous contractor viewers only.

## 2026-07-18 (design session 2)

- **Evidence page, not photos-only — ACCEPTED:** each record row on the page
  shows its photo strip **plus a datasheet chip**, and a **click-through
  opens a record-detail modal** showing the full record attributes
  (certifier-review use case). Datasheet upload stays on the owning tables;
  the chip here is read-only v1. *Consequence:* the page needs a more
  generic name than "Site Photos" — naming open (candidates: Documentation /
  Evidence / Submittals).
- **Record identity — ACCEPTED: Display Name** for all record families on
  this page. Prerequisite: Heat Pumps currently freeze `Tag` rather than
  `Display Name` — spun off as do-first feature
  `planning/archive/dated/2026-07-19/heat-pump-display-name/`.
- **Thermal Bridges in scope — CONFIRMED** by Ed (resolves the multi-select
  ambiguity from session 1: equipment + apertures + TB all in v1).
- **Envelope sub-tab slot — ACCEPTED: redirect** `/envelope/site-photos` →
  the new page's `#envelope` anchor.
- **D6 draft-vs-saved — ACCEPTED:** explicit Save, same behavior as
  Envelope/Materials today (plus the "unsaved changes" hint on the rollup).
- **D5 REFRAMED (in discussion):** single record `status` is being expanded
  into three per-record axes — specification / datasheet / photo. Direction
  under discussion: rename table `Status` column → `Specification Status`;
  datasheet+photo axes derived from attachment presence (not stored),
  with possible per-axis N/A waivers; evidence page becomes the QA cockpit
  where all three axes are visible/settable. See PRD §D5.

## 2026-07-18 (design session 3)

- **D5 ACCEPTED (full model):** (1) datasheet + photo axes are **derived**
  from attachment presence (≥1 = have it), with per-record per-axis N/A
  waiver flags set only from the Documentation page / record modal;
  (2) equipment DataTable `Status` column **renamed to `Specification
  Status`** (aligns with envelope/apertures' existing `specification_status`);
  (3) spec status stays settable on **both** the owning DataTable and the
  Documentation record card (two views, one dataset). Rollup = three chips
  per section + page: `Spec N/M · Datasheets N/M · Photos N/M`, filterable
  per axis.
- **Page name ACCEPTED: `Documentation`** — top-level tab, route
  `/projects/{id}/documentation`. The contractor-facing directions section
  inside keeps its "Site Photos" heading. Feature folder renamed
  `site-photos` → `documentation-tab` accordingly.
- **Future scope logged (Ed):** project-level documents — blower-door test
  reports, ventilation commissioning reports, and similar — conceptually
  belong in Documentation too. These are *project-scoped* documents (not
  per-record evidence), a distinct class: candidate future "Project
  Documents" section, likely relating to the Airtightness tab's
  project-level (non-versioned) stance. Explicitly **not v1**; see PRD §7.
- **Status-tab echo (parked):** the record-status projection could later
  show the same three chips per group ("what do we owe the certifier",
  project-wide). Not v1.

## 2026-07-18 (design session 4 — wireframe iteration)

- **US-ENV-15 amended in context docs** (story file + envelope-tab.md):
  marked ABSORBED, redirect noted.
- **Wireframe v1 → v2** (`assets/wireframe.html`), per Ed:
  - **Directions are per-category, on demand:** a "📖 How to photograph — X"
    button in each section header opens a category-specific modal (walls →
    wall shots, ventilators → ventilator shots, …). Never expanded by
    default. Content must be very explicit — numbered shot lists per record
    type — because field crews ask for exact directions and fear doing it
    wrong.
  - **Unified 3-column row grammar on every section:** record row →
    `Spec · Photos · Datasheet` columns; Photos and Datasheet each carry an
    editor-only inline **"not required" checkbox** (the per-axis waiver —
    supersedes session-3's modal-only waiver placement). Checked renders a
    muted "not required ✓" and counts as satisfied in rollups. Ed frames
    this grid as "the primary driver for all documentation requirements per
    record."
  - **Envelope dedup:** one row per **unique material per assembly** (a
    material in N segments of one assembly appears once; uploads fan out to
    all its segment arrays there — reuses the Materials-page use-site
    grouping). Note: the datasheet cell on an envelope row is
    material-level, so the same material in two assemblies shows the same
    datasheet chip in both rows (same underlying array — fine, projection).
  - Record modal simplified to read-only attributes + evidence (waivers
    moved inline).

## 2026-07-18 (design session 5)

- **Envelope grouping — CONFIRMED assembly-primary** after weighing the
  material-primary alternative. Rationale: the material-primary view
  already exists (Envelope → Materials sub-tab); Documentation's envelope
  section serves the field crew, who think by assembly. Requirement Ed
  attached (and the model already guarantees): the **datasheet cell is a
  material-level projection** — one `datasheet_asset_ids` array per
  ProjectMaterial, project-wide — so supplying a datasheet from any
  assembly row updates every assembly using that material instantly.
  Photos stay per material-per-assembly; datasheet waiver is material-level,
  photo waiver per material×assembly. Wireframe annotated (tag 7).

## Still open

- D2 remaining composition details: record-detail modal contents, waiver
  toggle UX, mobile behavior specifics.
- Rename mechanics for `Status` → `Specification Status` (display-name vs
  field-key migration) — phase-planning question.
- Confirm readiness to start phase plans (Ed's call).
