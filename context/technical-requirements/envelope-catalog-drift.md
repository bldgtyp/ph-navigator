# Envelope Catalog Drift — Contract

When a project material is copied from the materials catalog, the copy
is independent — the catalog row can change, the project value can
diverge, and the project author decides if and how to reconcile. The
drift report endpoint surfaces that state per project material so the
UI can render review badges and drive the refresh dialog.

## Endpoint

- REST: `GET /api/v1/projects/{project_id}/versions/{version_id}/envelope/material-catalog-drift?source=draft|version`

`source=draft` resolves to the caller's draft if present, falling back
to the saved version body; `source=version` always reads the saved
body. Authentication is project-scoped view access.

The endpoint short-circuits to an empty `materials` list if no project
material carries a `catalog_origin` (no catalog-derived materials → no
drift possible). The frontend skips the query in that case.

## Response shape

```json
{
  "project_id": "...",
  "version_id": "...",
  "source": "draft" | "version",
  "version_etag": "...",
  "draft_etag": "..." | null,
  "materials": [
    {
      "project_material_id": "...",
      "state": "<drift_state>",
      "catalog_record_id": "...",
      "local_overrides": ["<field_key>", ...],
      "fields": [
        {
          "key": "<field_key>",
          "project_value": <value>,
          "catalog_value": <value | null>,
          "is_overridden": <bool>,
          "differs": <bool>
        },
        ...
      ]
    },
    ...
  ]
}
```

`fields` covers every catalog-bound field in
`PROJECT_MATERIAL_CATALOG_FIELDS`: `name`, `category`, `density_kg_m3`,
`specific_heat_j_kgk`, `conductivity_w_mk`, `emissivity`, `color`,
`source`, `url`, `comments`.

## Drift states

The state machine has five terminal values. Computed by
`features.envelope.drift.project_material_drift_item`.

| State | When it fires |
|-------|---------------|
| `in_sync` | Catalog row exists and is active; every field matches; `local_overrides` is empty. The "nothing to do" state. |
| `customized` | Catalog row exists and is active; every field matches catalog values; `local_overrides` is non-empty. Reached when an author edited a field then refreshed it back to the catalog value (the override flag persists). The UI treats this as "user intent recorded, no action needed today." |
| `drifted` | Catalog row exists and is active; **at least one field differs** from the catalog. The "Catalog drift" review badge appears. Per-field `differs` and `is_overridden` distinguish "catalog moved" from "I moved" in the refresh dialog. |
| `source_deactivated` | Catalog row exists but `is_active == false`. The catalog admin retired the row; the project can keep or detach but cannot `refresh_project_material_from_catalog`. |
| `source_missing` | Catalog row was hard-deleted. The project material is now an orphan from the catalog's perspective; refresh is blocked. |

`catalog_value` is `null` for `source_deactivated` and `source_missing`
because no live catalog row drove the comparison.

`local_overrides` mirrors `catalog_origin.local_overrides` on the
project material — the **author-declared** override set. `differs`
is the **field-comparison** result. The two are independent and the
combination drives the four refresh actions surfaced to the user.

## Refresh action shape

The `refresh_project_material_from_catalog` command takes a
`field_choices` list — one entry per field the user wants to act on:

```json
{
  "key": "<field_key>",
  "action": "take_catalog" | "use_value" | "keep_mine",
  "value": <value>  // only for use_value
}
```

| Action | Effect |
|--------|--------|
| `take_catalog` | Project field is set to the current catalog value. `local_overrides` is **not** cleared (intent persists). |
| `use_value` | Project field is set to a caller-provided value. `local_overrides` is not modified by refresh — use the editor for that. |
| `keep_mine` | No-op for the field. Equivalent to omitting it from `field_choices`. |

Fields not enumerated in `field_choices` are treated as `keep_mine`.

`refresh_project_material_from_catalog` rejects the command with
HTTP 409 if the project material has no `catalog_origin`
(`project_material_has_no_catalog_origin`), the catalog row is missing
(`catalog_material_source_missing`), or the catalog row is deactivated
(`catalog_material_source_deactivated`). The refresh dialog only opens
for `drifted` rows; the other states are surfaced via static badges.

## See also

- `backend/features/envelope/drift.py` — drift computation.
- `backend/features/envelope/commands/materials.py` `refresh_*` —
  command handler.
- `backend/tests/envelope/test_envelope_catalog_drift.py` — contract
  tests covering all five states.
- `context/GLOSSARY.md` `Drift`, `Refresh from catalog`.
- `planning/archive/user-stories/20-envelope.md` US-ENV-11.
