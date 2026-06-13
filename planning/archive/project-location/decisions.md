---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Complete — archived resolved decisions for the Project Location feature.
AUTHOR: Claude (for Ed)
SCOPE: Accepted/rejected design forks. Folded back into PRD.md and
  the phase docs in the same pass.
RELATED:
  - planning/archive/project-location/PRD.md
  - planning/archive/project-location/README.md (item 3 = D-PL-1)
  - planning/archive/model-viewer/decisions.md D-07
---

# Project Location — Decisions

## D-PL-1 · Storage: dedicated `project_location` table + module
**Decided (Ed, 2026-06-12):** a 1:1 `project_location` table keyed by
`project_id` (PK = FK, ON DELETE CASCADE), owned by a new
`backend/features/project_location/` module (routes / models /
service / repository / mcp), not flat columns on `projects`.

**Why:** Location + EPW linkage is ~10 fields and a *growing* concern
(climate summary, degree days, dataset alignment anticipated). The
codebase is feature-first with narrow repositories (context/PRD.md
§6.1, §12.1). A dedicated 1:1 table keeps the hot `projects` row and
the dashboard list query (`PROJECT_COLUMNS`,
`backend/features/projects/repository.py`) lean, gives the feature a
clean home, and still honors the README's "relational, not versioned
JSONB" lean.

**Rejected — flat columns on `projects`:** matches the `phius_number`
precedent and reuses the generic `update_project_metadata` machinery
(less code), but fattens the core row with detail-only data and
entangles a growing concern into the projects feature. Lighter today,
worse as location grows. Revisit only if `project_location` never
gains fields beyond v1 (it is expected to).

## D-PL-2 · Sun-path wiring deferred to model-viewer
**Decided (Ed, 2026-06-12):** this feature ships location *data*
(Phases 1–3). The model-viewer extraction owns reading it and
populating the `sun_path` wire key.

**Why:** model-viewer already owns `ladybug`/`honeybee` and the
nullable `sun_path` key (its phase-02), and the renderer stub (its
phase-06). Those phases are not yet merged. Duplicating that here
would fork ownership of the sun path. The seam is documented in PRD
§10 so the wiring is a clean, scheduled handoff when MV Phases 2 + 6
land. Consistent with model-viewer Phase 6 ("Sun-path rendering …
integration happens in that feature's plan") and D-07.

## D-PL-3 · EPW parse owned by `project_location`, not assets
**Decided:** the generic asset pipeline stays generic. EPW *header*
parsing lives behind `POST /projects/{id}/location/epw/parse` in the
`project_location` feature, which reads the asset bytes via the assets
service's existing object-prefix read. The assets `_validate_magic`
(`backend/features/assets/service.py`) gains only a minimal "first
line is a `LOCATION,` record" check.

**Why:** keeps feature boundaries clean (assets shouldn't learn EPW
semantics), avoids building a per-kind parse-hook framework for one
consumer, and lets the parse return a *suggestion* (matching the
one-click-accept UX) rather than silently auto-filling on upload.

**Rejected — parse inside assets `complete_upload`:** would couple the
generic asset feature to EPW domain knowledge and auto-apply values
the user hasn't accepted.

## D-PL-4 · True-north stored in ladybug/honeybee convention
**Decided:** `true_north_deg` is the counterclockwise rotation in
degrees from the +Y axis (ladybug/honeybee GH `north` convention;
90°=West, 270°=East), validated `[0, 360)`.

**Why:** the only downstream consumer is `Sunpath.from_location`'s
`north_angle`; storing in its native convention avoids a translation
layer. **The exact sign is re-verified against the installed
`ladybug` with a known-orientation fixture at consumer-integration
time** (PRD §10) — a wrong sign silently rotates the sun path. README
item 1 explicitly required documenting this; here it is.

## D-PL-5 · Dedicated `/location` endpoint, not project `PATCH`
**Decided:** `GET/PUT /api/v1/projects/{id}/location` rather than
folding location fields into the generic `PATCH /projects/{id}`.

**Why:** location has its own range validation, its own non-blocking
EPW-mismatch warning response shape, and its own EPW actions — none of
which belong in generic project-metadata PATCH. A dedicated resource
also gives the MCP read tool a clean 1:1 target.
