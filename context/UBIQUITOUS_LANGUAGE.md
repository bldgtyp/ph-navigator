# Ubiquitous Language

> Extracted from the PH-Navigator V2 PRD set (`docs/plans/architecture-prd.md`,
> `ui-ux.md`, `user-stories.md`) on 2026-05-10. This is the canonical
> vocabulary for design discussions, code, API names, and docs. When a
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
| **Catalog**                | The shared, curated starting library of reusable entries (Materials, Window-Frame Elements, Window-Glazing) | Library, master list, reference data        |
| **Catalog entry**          | One identity row in a Catalog (e.g. one material), with one or more Catalog versions                       | Catalog row, catalog record, item           |
| **Catalog version**        | A specific snapshot of a Catalog entry's values (e.g. "Skyline Ridge frame, 2024 spec")                    | Catalog revision, spec, edition             |
| **Pick** *(verb)*          | Copying a Catalog version's values into a Project document; the Project then owns its copy                 | Import, link, reference, attach             |
| **Catalog origin**         | Metadata stored on a copied entry pointing back to the Catalog entry, version, schema_version, synced_at  | Source ref, provenance, lineage             |
| **Refresh from catalog**   | A per-entry UX that diffs a Project's copy against the live Catalog entry and lets the user reconcile     | Sync, pull updates, re-pick                 |
| **catalog_schema_version** | Integer pinned at Pick time recording the Catalog's row schema at that moment; drives shim chains         | Catalog spec version, catalog format        |
| **Project Material**       | A row in `tables.project_materials` — the Project's own copy of a Material, referenced by Segments by ID  | Material instance, used material            |

## Envelope (assemblies & windows)

| Term                  | Definition                                                                                                | Aliases to avoid                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Assembly**          | A named opaque envelope construction (`wall`, `floor`, `roof`, `other`) composed of ordered Layers       | Construction, build-up, wall section              |
| **Layer**             | One thickness band within an Assembly, made of one or more Segments side-by-side                          | Lamina, course, ply                                |
| **Segment**           | A horizontal slice of a Layer occupying a width (e.g. stud bay vs. stud); references a Project Material  | Strip, region, bay                                 |
| **Material**          | A physical product with thermal properties (conductivity, density, etc.); lives in the Catalog           | Product, substance (when ambiguous, qualify it)    |
| **Datasheet**         | A per-project QA submittal PDF attached to a Project Material; **never lives in the Catalog**             | Spec sheet (only if it's literally the PDF)        |
| **Window Type**       | A named window family defined by a row × column grid of Window Elements                                   | Window family, fenestration type                   |
| **Window Element**    | One pane/cell within a Window Type, carrying inlined Frame and Glazing data                               | Sash, lite (lite is sometimes specifically glass)  |
| **Frame Type**        | A frame product (jamb, head, sill, mullion) with U-value, psi-install, etc.; catalogged                   | Profile, frame product                             |
| **Glazing Type**      | A glazing assembly (IGU spec) with U-value, SHGC, etc.; catalogged                                        | Glass, IGU (unless literally referring to the IGU) |
| **Thermal Bridge**    | A linear envelope discontinuity carrying a psi-value, optional simulation file, and length                | TB, junction (junction is the geometric thing)     |

## Rooms & equipment

| Term            | Definition                                                                                       | Aliases to avoid                              |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Room**        | One interior space with floor level, occupancy, iCFA factor, and ERV associations                | Space, zone (Building Zone is separate), unit |
| **Building Zone** | A user-defined single-select grouping a Room belongs to                                        | Sector, area, region                          |
| **Equipment**   | Mechanical devices the Project owns; in v1: Fans, Pumps, ERVs                                    | Devices, gear, MEP                            |
| **ERV**         | An ERV/HRV ventilation unit row; `unit_type` is a user-defined option                            | Ventilator, recovery unit                     |
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
| **Tab**             | One section of the Project workspace: Status, Windows, Envelope, Equipment, Model                              | Page, panel, view (use only contextually)         |
| **Builder**         | The collective editing surfaces inside the Project workspace (everything that writes to the document)          | Editor, authoring mode                            |
| **Catalog manager** | The top-nav surface for editing Catalog entries (`/catalog/{slug}`)                                            | Library admin, catalog editor                     |
| **DataTable**       | The shared React grid component used by every tabular surface (Catalog pages, Builder sub-tabs, picker, etc.) | Grid, table (lowercase "table" = data table)    |
| **Bookshelf picker**| The modal/inline UI for picking from a Catalog into a Project                                                  | Library picker, catalog browser                   |
| **Version panel**   | The Version list + Save / Save As / Lock controls on the Project workspace                                     | History panel, revisions sidebar                  |

## Relationships

- A **Project** has one or more **Versions**; one is the **Active version**.
- A **Version** holds one **Project document** (its `body`). Editing flows through a **Draft**, never the Version body directly.
- **Save** overwrites the Active version; **Save As** creates a new Version. Locked Versions reject Save.
- A **Project document** contains **Tables**: `assemblies`, `project_materials`, `window_types`, `rooms`, `thermal_bridges`, `equipment`, `manufacturer_filters`.
- An **Assembly** has ordered **Layers**; each Layer has **Segments**; each Segment references a **Project Material** by id.
- A **Project Material** is the Project's copy of a Catalog **Material**, linked back via **catalog_origin**.
- A **Window Type** is a grid of **Window Elements**, each inlining a **Frame Type** and **Glazing Type** (no `project_frame_types` table — frames are inlined, unlike Materials).
- **Catalog entries** have **Catalog versions**; Picking copies values in. A Project never references a Catalog version live.
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
- **"Tab"** in this product means a workspace section (Status/Windows/Envelope/Equipment/Model), but the same word is used for browser tabs in concurrency discussions ("a second browser tab opening the same Version"). Qualify with "workspace tab" vs "browser tab" when both are in play.
- **"Snapshot"** appears as both (a) a Version `kind` (`'snapshot'`) and (b) loose talk for any saved Version. Prefer **Version** for the general concept; reserve **snapshot** for the specific `kind`.
- **"Status"** is the workspace **Tab** name *and* the project-lifecycle tracker (`project_status_items`). The two are aligned (the Tab renders the tracker), but "Status" alone is ambiguous in code — prefer `project_status_items` or "Status tab" depending on context.
