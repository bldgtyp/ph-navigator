---
DATE: 2026-09-14
TIME: 19:13 EDT
STATUS: Merged to main via PR #97 (2026-09-14)
AUTHOR: Claude (with Ed May)
SCOPE: One implementation slice: models, service, routes, tests, docs
RELATED: README.md, STATUS.md, backend/features/desktop/, backend/tests/test_desktop.py
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/96
---

# Plan

## Verified starting facts

Checked against `main` at `7b5aa818`:

- `backend/features/desktop/` exposes only `session` and `catalogs/materials`.
  `get_materials()` wraps `list_materials(include_inactive=False).items` in a
  strict envelope. The new routes copy that shape one-for-one.
- `list_frame_types(...)` and `list_glazing_types(...)` take keyword-only
  filters that default to `None`/`False`. Called with `include_inactive=False`
  and no filters, they produce exactly what the browser `GET` list routes
  return by default, so `rows == browser items` holds by construction.
- `CatalogFrameTypeListItem` / `CatalogGlazingTypeListItem` already omit
  `created_by` / `updated_by` and match the field lists in #96 exactly.
  No new DTO fields, no renames.
- `catalog_frame_types` has no CHECK on `psi_g_w_mk` or `width_mm` (baseline
  migration); only the create/update request validators reject negatives. A
  stored negative psi-g (import, SQL fix-up) therefore reaches the list DTO as a
  plain `float | None` and is not clamped. A test pins that.
- Desktop reads share the device-poll limiter, 120 requests/min per IP. The
  client now makes four desktop calls instead of two. No change needed.
- `clean_catalog_tables` truncates both window catalog tables but not
  `catalog_field_options`. The tests below avoid single-select fields anyway,
  so they do not depend on seeded option labels.

## Decisions

**D1: approval-page copy. Accepted by Ed 2026-09-14: change the copy.** #96 says "no frontend changes", but the
consent page labels `catalog:read` as **Read the shared material library**,
and the catalog-only note says the credential can "read the shared material
library". Once this ships, both are too narrow. PR #91's PRD called the label
part of the consent contract. Recommendation: change the two strings in the
same PR (`frontend/src/features/mcp/constants.ts`, the note in
`ApproveAgentPage.tsx`), plus the `App.test.tsx` assertion and
`context/ui/pages/agent-access.md`. Proposed label: **Read the shared material,
frame, and glazing libraries**. Leaving the copy unchanged is also workable,
because the grant stays read-only and catalog-only. In that case, add a
follow-up issue instead.

**D2: archive the #90 packet in this PR. Accepted by Ed 2026-09-14.** The consumer's phase-8f
evidence shows that production already issues `catalog:read` grants and serves
Materials (408 rows). That meets the #90 packet's remaining closeout condition,
which was the deploy plus a real extension sign-in. Its `STATUS.md` is stale.
The docs pass for this PR moves it to `planning/archive/desktop-catalog-read/`
and adds the archive README row.

**D3: test structure.** The single materials test grows into a projection test
parametrized over all three catalogs, with the session assertion split into its
own test. Materials assertions carry over unchanged, so "existing Materials
behavior is unchanged" stays covered by the same checks.

## Step 1: models (`backend/features/desktop/models.py`)

Add, after `DesktopMaterials` and following its shape exactly:

```python
class DesktopFrameTypes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["frames"] = "frames"
    library_id: Literal["ph-navigator-web:frame-types"] = "ph-navigator-web:frame-types"
    server_time: datetime
    rows: list[CatalogFrameTypeListItem]


class DesktopGlazingTypes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["glazings"] = "glazings"
    library_id: Literal["ph-navigator-web:glazing-types"] = "ph-navigator-web:glazing-types"
    server_time: datetime
    rows: list[CatalogGlazingTypeListItem]
```

Imports: `CatalogFrameTypeListItem` from `features.catalogs.frame_types.models`,
`CatalogGlazingTypeListItem` from `features.catalogs.glazing_types.models`.

## Step 2: service (`backend/features/desktop/service.py`)

Mirror `get_materials()`:

```python
def get_frame_types() -> DesktopFrameTypes:
    """Active frame list projection only; stored values pass through unchanged."""
    return DesktopFrameTypes(server_time=now_utc(), rows=list_frame_types(include_inactive=False).items)


def get_glazing_types() -> DesktopGlazingTypes:
    """Active glazing list projection only; no synthesized product fields."""
    return DesktopGlazingTypes(server_time=now_utc(), rows=list_glazing_types(include_inactive=False).items)
```

Pass no filter arguments. `require_desktop_token` is not touched.

Update the one-line docstring in `backend/features/desktop/repository.py` from
"material catalog repositories" to "catalog repositories".

## Step 3: routes (`backend/features/desktop/routes.py`)

```python
@router.get("/catalogs/frame-types", response_model=DesktopFrameTypes)
def get_catalog_frame_types(auth: DesktopToken) -> DesktopFrameTypes:
    del auth
    return get_frame_types()


@router.get("/catalogs/glazing-types", response_model=DesktopGlazingTypes)
def get_catalog_glazing_types(auth: DesktopToken) -> DesktopGlazingTypes:
    del auth
    return get_glazing_types()
```

Routes take no query parameters, so `?include_inactive=true` is ignored exactly
as it is on Materials. The router-level rate-limit dependency applies
automatically. `main.py` already includes the desktop router.

## Step 4: tests (`backend/tests/test_desktop.py`)

Keep the file's existing style: module constants, plain helpers, no new
fixtures.

1. **Constants.** Name the paths and extend `ENDPOINTS` to all four:
   `SESSION`, `MATERIALS`, `FRAMES = f"{BASE}/catalogs/frame-types"`,
   `GLAZINGS = f"{BASE}/catalogs/glazing-types"`,
   `CATALOG_ENDPOINTS = (MATERIALS, FRAMES, GLAZINGS)`,
   `ENDPOINTS = (SESSION, *CATALOG_ENDPOINTS)`. The existing
   `test_missing_or_malformed_bearer`, `test_unusable_token`, and
   `test_wrong_scope_or_project_token` then cover the new routes without edits
   (issue acceptance: shared auth matrix covers all three catalog routes).
   `test_desktop_uses_device_poll_rate_budget` keeps using session and
   Materials.
2. **Helper.** Extract the inline admin sign-in in the current materials test
   into `catalog_admin_client() -> TestClient`, using `create_catalog_admin`
   as it does today.
3. **`test_session_metadata`.** The existing session assertion, moved out
   unchanged.
4. **`test_active_catalog_projection` parametrized over three cases**:
   `(desktop path, browser path, kind, library_id, create payload)`.
   - Materials: current payload (`category: "insulation"`, conductivity).
   - Frames: `{"suffix": ..., "width_mm": 100.0, "u_value_w_m2k": 0.85, "psi_g_w_mk": 0.04}`.
   - Glazings: `{"suffix": ..., "u_value_w_m2k": 0.7, "g_value": 0.5}`.

   Payloads leave single-select fields out on purpose. The server derives
   `name`, so assertions compare **ids**, not names. The body carries over
   from the current materials test, per kind: create an active row and an
   inactive row, soft-delete the inactive one, then assert:
   - `set(body) == {"kind", "library_id", "server_time", "rows"}`, plus the
     exact `kind` and `library_id` literals;
   - `server_time` falls between before/after `datetime.now(UTC)`;
   - `body["rows"] == signed_in_client.get(browser path).json()["items"]`;
   - `[row["id"] for row in body["rows"]] == [active_id]`;
   - `created_by` / `updated_by` are absent from the row;
   - `?include_inactive=true` returns the same rows;
   - `mcp_tokens.last_used_at` is set, so the new routes are covered too;
   - the browser route with the bearer returns 401.
5. **`test_frame_projection_preserves_stored_values`.** Create one frame, then
   `UPDATE catalog_frame_types SET psi_g_w_mk = -0.004 WHERE id = %s`.
   Assert the desktop row has `id` equal to the created id,
   `psi_g_w_mk == -0.004`, and `width_mm == 100.0`, and that the row keys equal
   `CatalogFrameTypeListItem.model_fields` (no `product_code`). Issue
   acceptance: no reinterpreted width, no clamped psi-g, no synthesized code.
6. **Device flow.** In `test_catalog_only_device_flow_and_single_redemption`,
   loop the redeemed bearer over `CATALOG_ENDPOINTS` and assert 200 and
   `rows == []` for each. Issue acceptance: one grant serves all three.

Test count: 27 today (22 auth-matrix cases on 2 endpoints, plus 5 others).
After: 44 auth-matrix cases on 4 endpoints, 1 session, 3 projection, 1 frame
values, device flow, scope validation, rate limit, and migration, for 53 total.
Report the real number.

## Step 5: frontend (only if D1 = change copy)

- `frontend/src/features/mcp/constants.ts`: `CATALOG_READ_SCOPE_LABEL`.
- `frontend/src/features/mcp/routes/ApproveAgentPage.tsx`: the catalog-only
  approval note.
- `frontend/src/App.test.tsx`: the label assertion.
- `pnpm run format`.

## Step 6: docs

- `context/technical-requirements/api.md`: add both routes to the route list
  under `# desktop`. In **Desktop catalog reads**, change "Both desktop
  routes" to "All desktop routes", add the two envelope examples with their
  DTO and service names, and state that stored values (signed `psi_g_w_mk`,
  `width_mm`) pass through unchanged and no product or product-code field is
  synthesized. Remove "frames, or glazing" from the out-of-scope sentence.
- `context/mcp.md`: "the shared active material library" becomes "the
  shared active material, frame, and glazing catalogs".
- `context/ui/pages/agent-access.md`: only if D1 = change copy.
- `planning/`: this packet's `STATUS.md`, plus the D2 archive move.

## Step 7: verification and closeout

Per the repo closeout gate (`CLAUDE.md`):

1. `cd backend && uv run pytest tests/test_desktop.py tests/test_catalogs_frame_types.py tests/test_catalogs_glazing_types.py`
   against Docker Postgres.
2. `simplify` skill on the diff, then `docs-pass` skill.
3. `make format`, then `make ci` (includes `make check-backend`; the frontend
   half matters only under D1).
4. `graphify update .`
5. PR from `feature/desktop-window-catalog-read` with `Closes #96`. No
   migration note is needed.

Post-merge, and Ed's call: run the Deploy Production workflow. Then re-run the
SketchUp phase-8f production walkthrough from a fresh process with one retained
grant: fetch all three catalogs, then bookshelf and assign one real Frame and
one real Glazing. That walkthrough is the last #96 acceptance item. It is
recorded in the SketchUp repo, not here.

## Build routing

Claude has written this spec. `gpt-5.6-sol` builds Steps 1–4 and 6 (plus 5 if
D1 = change) through the `codex-implementation` skill. Claude reviews the diff
and runs the database-backed tests and closeout gate locally, because the
Codex sandbox cannot reach Docker Postgres (see #90 STATUS).
