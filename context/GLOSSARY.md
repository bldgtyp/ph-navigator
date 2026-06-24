# Ubiquitous Language

> Extracted from the PH-Navigator V2 PRD set (`context/PRD.md`,
> `context/UI_UX.md`, `context/USER_STORIES.md`) on 2026-05-10.
> This is the canonical vocabulary for design discussions, code, API
> names, and docs. When a
> term here conflicts with a term elsewhere, this file wins — fix the
> other one.

## Project & versioning

| Term                  | Definition                                                                                              | Aliases to avoid                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Project**           | One building tracked through its lifecycle; identified by a `bt_number` and a UUID                      | Building, job, file (use only as metaphor)         |
| **Project document**  | The JSON body of a single **Version** — the canonical, validated representation of all project data    | Body, JSON, payload, blob                          |
| **Version**           | A named, individually-saveable snapshot of a Project document (e.g. "Working", "Round 1 Submit")        | Revision, snapshot (snapshot is a `kind`), copy   |
| **Active version**    | The Version a user opens by default for a Project                                                       | Current version, default version                   |
| **Draft**             | A server-side WIP buffer of in-flight edits to a Version; crash-recovery only, never a listed Version  | Draft version, pending version, autosave snapshot |
| **Save**              | Overwrite the active Version's body with the current Draft                                              | Commit, persist, write                             |
| **Save As**           | Create a new Version from the current Draft and switch to it                                            | Fork, branch, new revision                         |
| **Lock**              | A flag on a Version that rejects further Saves; required for cert submits and project close            | Freeze, finalize, protect                          |
| **Kind**              | A Version's lifecycle label: `working`, `submitted`, `closed`, or `snapshot`                            | State, phase, status (Status is a separate thing)  |
| **schema_version**    | The integer revision of the Project document shape; independent of API version                          | Doc version, body version                          |

## Catalog (the "bookshelf")

| Term                       | Definition                                                                                                 | Aliases to avoid                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Catalog**                | The shared, curated starting library of reusable entries (Materials, Frame Types, Glazing Types)            | Library, master list, reference data        |
| **Catalog entry**          | One identity row in a Catalog (e.g. one material), with one or more Catalog versions                       | Catalog row, catalog record, item           |
| **Catalog version**        | A specific snapshot of a Catalog entry's values (e.g. "Skyline Ridge frame, 2024 spec")                    | Catalog revision, spec, edition             |
| **Pick** *(verb)*          | Copying a Catalog version's values into a Project document; the Project then owns its copy                 | Import, link, reference, attach             |
| **Catalog origin**         | Metadata stored on a copied entry pointing back to the Catalog entry, version, schema_version, synced_at  | Source ref, provenance, lineage             |
| **Refresh from catalog**   | A per-entry UX that diffs a Project's copy against the live Catalog entry and lets the user reconcile     | Sync, pull updates, re-pick                 |
| **catalog_schema_version** | Integer pinned at Pick time recording the Catalog's row schema at that moment; drives shim chains         | Catalog spec version, catalog format        |
| **Project Material**       | A row in `tables.project_materials` — the Project's own copy of a Material, referenced by Segments by ID  | Material instance, used material            |
| **Project Glazing**        | A row in `tables.project_glazings` — the Project's own documented copy of a Glazing Type, referenced by Aperture Elements by `glazing_id` | Glazing instance, used glazing              |
| **Project Frame**          | A row in `tables.project_frames` — the Project's own documented copy of a Frame Type, referenced by Aperture Element frame-side ids | Frame instance, used frame                  |

## Envelope (assemblies & apertures)

| Term                  | Definition                                                                                                | Aliases to avoid                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Assembly**          | A named opaque envelope construction (`wall`, `floor`, `roof`, `other`) composed of ordered Layers       | Construction, build-up, wall section              |
| **Layer**             | One thickness band within an Assembly, made of one or more Segments side-by-side                          | Lamina, course, ply                                |
| **Segment**           | A horizontal slice of a Layer occupying a width (e.g. stud bay vs. stud); references a Project Material  | Strip, region, bay                                 |
| **Material**          | A physical product with thermal properties (conductivity, density, etc.); lives in the Catalog           | Product, substance (when ambiguous, qualify it)    |
| **Datasheet**         | A per-project QA submittal PDF attached to a Project Material; **never lives in the Catalog**             | Spec sheet (only if it's literally the PDF)        |
| **Aperture Type**     | A named aperture family (doors, windows, skylights) defined by a row × column grid of Aperture Elements   | Window type, fenestration type                     |
| **Aperture Element**  | One pane/cell within an Aperture Type, carrying per-side Project Frame ids (`top/right/bottom/left`) and one Project Glazing id | Window element, sash, lite (lite = glass)   |
| **Frame Type**        | A frame product (jamb, head, sill, mullion) with U-value, psi-install, etc.; catalogged                   | Profile, frame product                             |
| **Glazing Type**      | A glazing assembly (IGU spec) with U-value, SHGC, etc.; catalogged                                        | Glass, IGU (unless literally referring to the IGU) |
| **Thermal Bridge**    | A linear envelope discontinuity carrying a psi-value, optional simulation file, and length                | TB, junction (junction is the geometric thing)     |

## Thermal performance

PHN follows honeybee-energy (LBT) terminology **verbatim** for U/R
quantities (D-12, accepted 2026-06-12): **"-Factor" = air films
included; "-Value" = air films excluded.**

| Term         | Definition                                                                                                          | Aliases to avoid                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **U-Factor** | Heat-transfer coefficient **including** standard interior + exterior air-film resistances (EN673 / ISO10292); honeybee `u_factor`. Manufacturer whole-assembly and PHPP-style values are almost always Factors | U-Value (when films are included)      |
| **U-Value**  | Heat-transfer coefficient of the material layers only, films **excluded**; honeybee `u_value`. Matches the envelope builder's layer-sum convention | U-Factor (when films are excluded)     |
| **R-Factor** | Thermal resistance including air films; honeybee `r_factor`                                                            | —                                       |
| **R-Value**  | Thermal resistance of layers only, films excluded; honeybee `r_value`                                                  | —                                       |

Surfaces that show both quantities (e.g. the Model tab inspector)
label each row explicitly and state the film convention in tooltips.

## Rooms & equipment

| Term            | Definition                                                                                       | Aliases to avoid                              |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Room**        | One interior space with floor level, occupancy, iCFA factor, and ERV associations                | Space, zone (Building Zone is separate), unit |
| **Building Zone** | A user-defined single-select grouping a Room belongs to                                        | Sector, area, region                          |
| **Equipment**   | Mechanical devices the Project owns; in v1: Fans, Pumps, ERVs, Heat Pumps                        | Devices, gear, MEP                            |
| **ERV**         | An ERV/HRV ventilation unit row; `unit_type` is a user-defined option                            | Ventilator, recovery unit                     |
| **HP Outdoor Equipment** | Project-scoped "type" table row. One row per unique AHRI-rated outdoor + paired-indoor model combo used on the project. Carries the performance data the Phius HP Estimator consumes. | HP type, outdoor model, HP equip |
| **HP Indoor Equipment** | Project-scoped type table row. One row per unique indoor head / cassette / concealed-duct model used on the project.        | Indoor type, AHU model                        |
| **HP Outdoor Unit** | An installed condenser instance with a drawing-schedule tag (e.g. `HP-17`). References one HP Outdoor Equipment row. | Outdoor unit, condenser, HP instance          |
| **HP Indoor Unit** | An installed indoor head / cassette / concealed-duct instance with a drawing-schedule tag (e.g. `AHU-17L`). References one HP Indoor Equipment row, the HP Outdoor Unit it's wired to, and 0..N served Rooms. | Indoor unit, AHU instance, head           |
| **Integrated unit** | A physical box that implements both an HP indoor coil and an ERV core (e.g. Mitsubishi LEV Kit + Lossnay LGH). Modeled as one HP Indoor Unit row + one ERV row, linked by `linked_erv_unit_id`. | Combo unit, dual unit, hybrid ERV    |
| **Phius HP Performance Estimator** | The current-version Phius spreadsheet (`Phius_Heat Pump Performance Estimator_v25.1.1`) whose "Air Source Heat Pump Performance Data" section is the export target for HP Outdoor Equipment. | Phius HP calc, HP estimator        |
| **HBJSON**      | A Honeybee-PH JSON model file uploaded for the Model tab's 3D viewer; **read-only**, never imports into Builder tables | HB model, 3D file, geometry file |

## People & access

| Term         | Definition                                                                                                          | Aliases to avoid                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **User**     | An authentication identity (a row in `users`) — currently Ed or John                                                | Login, account                            |
| **Editor**   | A signed-in User with write permission on every Project                                                             | Author, admin, member                     |
| **Viewer**   | An unauthenticated visitor with read-only access via a Project URL                                                  | Guest, public user, anonymous client      |
| **Owner**    | The User listed in `projects.owner_id`; **dashboard-organization concept only, not an ACL**                         | Author, admin, project lead               |
| **Session**  | A server-side authenticated session row; single-active-per-user with 60-minute sliding idle expiry                  | Token (Session ID is a token, but bare "token" is ambiguous) |

## UI surfaces

| Term                | Definition                                                                                                     | Aliases to avoid                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Dashboard**       | The signed-in landing page (`/dashboard`) listing the User's owned Projects                                    | Home, projects page                               |
| **Project workspace** | The per-Project page (`/projects/{id}`) hosting the tab strip and Version panel                              | Project page, editor                              |
| **Tab**             | One section of the Project workspace: Status, Apertures, Envelope, Equipment, Model                              | Page, panel, view (use only contextually)         |
| **Builder**         | The collective editing surfaces inside the Project workspace (everything that writes to the document)          | Editor, authoring mode                            |
| **Catalog manager** | The top-nav surface for editing Catalog entries (`/catalog/{slug}`)                                            | Library admin, catalog editor                     |
| **DataTable**       | The shared React grid component used by every tabular surface (Catalog pages, Builder sub-tabs, picker, etc.) | Grid, table (lowercase "table" = data table)    |
| **Display Name**    | The user-facing label rendered in a DataTable's pinned leading identifier column — the row's descriptive `name` (a `{Number} — {Name}` formula on Rooms). Declared per-table via the `isIdentifier` column flag. Always non-unique — duplicate values surface a non-blocking warning chip. Maps to Honeybee `display_name`. Supersedes the retired **"Record-ID"** and **"Name"** labels. | Identifier column, primary field, pinned label |
| **Tag**             | The ordinary, non-unique short-code field (`record_id` field key) — formerly the pinned identifier, now an unpinned, editable, non-constrained column. Absent on Rooms (whose Display Name is the `{Number} — {Name}` formula). | Short code, `record_id` |
| **Database-ID**     | The per-row PK (`pmp_…`, `rm_…`, `rec_…`) that drives FK joins, React keys, undo, and clipboard mapping. Never rendered in DataTable UI; it is the only enforced-unique row identity. Distinct from the **Display Name**, which is a non-unique label. Maps to Honeybee `identifier`. Project-document PKs (`pmp_…`, `rm_…`) are local to their database; catalog `rec_…` ids are additionally a *portable* identifier — they appear verbatim in exported Catalog JSON files and serve as the dedup key when re-importing (see `planning/features/materials-catalog-import-export/`). | Row id, PK, internal id |
| **Bookshelf picker**| The modal/inline UI for picking from a Catalog into a Project                                                  | Library picker, catalog browser                   |
| **Version panel**   | The Version list + Save / Save As / Lock controls on the Project workspace                                     | History panel, revisions sidebar                  |

## Relationships

- A **Project** has one or more **Versions**; one is the **Active version**.
- A **Version** holds one **Project document** (its `body`). Editing flows through a **Draft**, never the Version body directly.
- **Save** overwrites the Active version; **Save As** creates a new Version. Locked Versions reject Save.
- A **Project document** contains **Tables**: `assemblies`, `project_materials`, `project_glazings`, `project_frames`, `apertures`, `rooms`, `thermal_bridges`, `equipment`, `manufacturer_filters`.
- An **Assembly** has ordered **Layers**; each Layer has **Segments**; each Segment references a **Project Material** by id.
- A **Project Material** is the Project's copy of a Catalog **Material**, linked back via **catalog_origin**.
- An **Aperture Type** is a grid of **Aperture Elements**, each referencing four side-specific **Project Frame** rows and one **Project Glazing** row by id. Apertures cover all envelope openings — doors, windows, skylights.
- **Catalog entries** have **Catalog versions**; Picking copies values in. A Project never references a Catalog version live.
- **Heat Pumps** are modeled as four project-scoped tables under `tables.equipment`: `heat_pump_outdoor_equip` (types) ← `heat_pump_outdoor_units` (instances, 1:N) → `heat_pump_indoor_units` (instances, 1:N) → `heat_pump_indoor_equip` (types, N:1). Indoor units may additionally link to an **ERV** row via `linked_erv_unit_id` for **Integrated unit** cases.
- **HBJSON** files are independent of Versions and never feed Builder tables.

## Example dialogue

> **Dev:** "When the user clicks Save on a locked Version, what happens to the **Draft**?"

> **Domain expert:** "Save returns 409 — locked Versions reject Save. The Draft stays untouched. The UI prompts the user to **Save As** instead, which creates a new Version from the Draft and clears it."

> **Dev:** "And if the user picks a new **Material** from the **Catalog** into an **Assembly Segment** while drafting — is that change in the Version yet?"

> **Domain expert:** "No. The Pick adds a row to `tables.project_materials` and sets the Segment's `project_material_id` *in the Draft body*. The Version's saved body doesn't change until Save runs. The new **Project Material** carries a **catalog_origin** so **Refresh from catalog** can later diff it against the live Catalog entry."

> **Dev:** "What if the Catalog **schema_version** has bumped since the Pick?"

> **Domain expert:** "The Project Material still has the old `catalog_schema_version` pinned on its `catalog_origin`. When the user opens Refresh, the shim chain runs the project's pinned snapshot forward to the current Catalog schema before computing the diff — the Project document itself isn't migrated until the user accepts."

## Flagged ambiguities

- **"Project"** was used in two senses across the PRD: (a) the **Project** entity (metadata, owner, bt_number) and (b) the **Project document** (the JSONB body of a Version). These are distinct — Project metadata lives in the `projects` row; Project document lives in `project_versions.body`. Always qualify "Project document" when you mean the JSON body.
- **"Material"** is overloaded: it can mean a **Catalog entry** (`catalog_materials`), a **Catalog version** (`catalog_material_versions`), or a **Project Material** (the inlined copy in `tables.project_materials`). Use the qualified term — the distinction matters for Refresh-from-catalog semantics.
- **"Draft"** is *not* a kind of Version — it's a server-side WIP buffer for crash-recovery. Never list it as a Version, never include it in diff `from`/`to` selectors except for "live vs last save" explicitly.
- **"Owner"** is a dashboard-organization label, not a permission. Either Editor can edit any Project; ownership only filters the dashboard view. Don't conflate with ACL — there is no per-project ACL in v1.
- **"Tab"** in this product means a workspace section (Status/Apertures/Envelope/Equipment/Model), but the same word is used for browser tabs in concurrency discussions ("a second browser tab opening the same Version"). Qualify with "workspace tab" vs "browser tab" when both are in play.
- **"Snapshot"** appears as both (a) a Version `kind` (`'snapshot'`) and (b) loose talk for any saved Version. Prefer **Version** for the general concept; reserve **snapshot** for the specific `kind`.
- **"Status"** is the workspace **Tab** name *and* the project-lifecycle tracker (`project_status_items`). The two are aligned (the Tab renders the tracker), but "Status" alone is ambiguous in code — prefer `project_status_items` or "Status tab" depending on context.
