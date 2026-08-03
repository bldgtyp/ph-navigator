---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Complete — evidence base for the packet
AUTHOR: Claude with Ed May
SCOPE: Measured evidence for the attachment-reference defects: reachability
  matrix, probe methodology, subsystem blast radius, and regression archaeology.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# Research — attachment reference reachability

Everything below was executed against the working tree at
`32a96839` in `backend/.venv` via `uv run`, not inferred from reading.

## 1. The reachability matrix

Method: construct a real empty project document
(`empty_project_document(CreateProjectRequest(...))`), then for each of the 30
`AttachmentFieldConfig` entries inject one row carrying a unique asset id into
that table + field **preserving the table's real envelope shape**, and ask
`list_asset_references()` whether it finds the id.

```
  project_materials.datasheet_asset_ids        FOUND        rows_walked=1
  project_glazings.datasheet_asset_ids         FOUND        rows_walked=1
  project_glazings.photo_asset_ids             FOUND        rows_walked=1
  project_frames.datasheet_asset_ids           FOUND        rows_walked=1
  project_frames.photo_asset_ids               FOUND        rows_walked=1
  assembly_segments.photo_asset_ids            FOUND        rows_walked=1
  ventilators.datasheet_asset_ids              FOUND        rows_walked=1
  pumps.datasheet_asset_ids                    FOUND        rows_walked=1
  fans.datasheet_asset_ids                     FOUND        rows_walked=1
  hot_water_heaters.datasheet_asset_ids        FOUND        rows_walked=1
  hot_water_tanks.datasheet_asset_ids          FOUND        rows_walked=1
  electric_heaters.datasheet_asset_ids         FOUND        rows_walked=1
  appliances.datasheet_asset_ids               FOUND        rows_walked=1
  thermal_bridges.datasheet_asset_ids          MISS         rows_walked=0 <<<
  heat_pump_outdoor_equip.datasheet_asset_ids  MISS         rows_walked=0 <<<
  heat_pump_indoor_equip.datasheet_asset_ids   MISS         rows_walked=0 <<<
  heat_pump_outdoor_units.datasheet_asset_ids  MISS         rows_walked=0 <<<
  heat_pump_indoor_units.datasheet_asset_ids   MISS         rows_walked=0 <<<
  ventilators.photo_asset_ids                  FOUND        rows_walked=1
  pumps.photo_asset_ids                        FOUND        rows_walked=1
  fans.photo_asset_ids                         FOUND        rows_walked=1
  hot_water_heaters.photo_asset_ids            FOUND        rows_walked=1
  hot_water_tanks.photo_asset_ids              FOUND        rows_walked=1
  electric_heaters.photo_asset_ids             FOUND        rows_walked=1
  appliances.photo_asset_ids                   FOUND        rows_walked=1
  thermal_bridges.photo_asset_ids              MISS         rows_walked=0 <<<
  heat_pump_outdoor_equip.photo_asset_ids      MISS         rows_walked=0 <<<
  heat_pump_indoor_equip.photo_asset_ids       MISS         rows_walked=0 <<<
  heat_pump_outdoor_units.photo_asset_ids      MISS         rows_walked=0 <<<
  heat_pump_indoor_units.photo_asset_ids       MISS         rows_walked=0 <<<

20/30 registered fields reachable; 10 unreachable
```

Plus an 11th broken column that does not appear above because it is not
registered at all: `thermal_bridges.pdf_report_asset_ids`.

```
thermal_bridges entries in ATTACHMENT_FIELDS:
    thermal_bridges.datasheet_asset_ids
    thermal_bridges.photo_asset_ids
any pdf_report field registered? False
total registered fields: 30
```

## 2. Why those ten miss — envelope shape

The empty document's actual table shapes:

```
thermal_bridges      dict['field_defs', 'rows']
project_materials    list(len=0)
project_glazings     list(len=0)
project_frames       list(len=0)
assemblies           list(len=0)

equipment.pumps (and siblings)   dict['field_defs', 'rows']
equipment.heat_pumps.outdoor_equip (and siblings)   dict['field_defs', 'rows']
```

`iter_rows_for_raw_tables` (`backend/features/assets/registry.py:281-305`) uses
two different readers:

- `attachment_table_rows(...)` — unwraps a `{"rows": [...]}` envelope **and**
  accepts a bare list. Used for the seven `EQUIPMENT_ATTACHMENT_TABLE_KEYS`.
- `_dict_rows(...)` — accepts a bare list only; returns `[]` for a dict. Used
  for `project_materials`, `project_glazings`, `project_frames` (all genuinely
  bare lists — fine), and for **`thermal_bridges` and the four
  `HEAT_PUMP_ATTACHMENT_TABLE_KEYS`**, which are envelopes.

Demonstrated directly on a populated envelope:

```
populated {field_defs, rows} envelope:
   _dict_rows            -> 0
   attachment_table_rows -> 1

   iter_rows_for_raw_tables(thermal_bridges        ) -> 0
   iter_rows_for_raw_tables(pumps                  ) -> 1
   iter_rows_for_raw_tables(heat_pump_outdoor_equip) -> 0
```

`attachment_table_rows` is a strict superset of `_dict_rows` — it falls through
to the same list handling. So the fix is to use it for every branch.

## 3. Blast radius — five subsystems read this one function

`list_asset_references` / `iter_rows_for_raw_tables` consumers:

| Consumer | Site | Effect of a zero-row walk |
| --- | --- | --- |
| Anonymous asset gate | `assets/service.py:310,280,354,343` | attachments hidden (`list`, `bulk_urls`) or refused (404 `asset_not_found`, 403 `asset_not_referenced`) |
| Orphan sweeper | `assets/orphan_sweeper.py:92` | asset classifies `unreferenced_upload` → R2 object copied to orphan prefix and **original deleted** |
| Write validation | `assets/reference_validation.py:26` | no existence / cross-project / upload-status / count / MIME check on those references |
| Bulk download | `assets/downloads.py:93` | `ValueError("No matching assets.")` → failed job, for signed-in users too |
| `find_row` → attach/detach | `assets/downloads.py:186`, used by `service.py:531` | 404 `document_row_not_found` |

The attach/detach breakage was verified directly:

```
pumps                    -> row found
thermal_bridges          -> document_row_not_found
heat_pump_outdoor_equip  -> document_row_not_found
```

This is why the browser can still attach files to those tables while the API
cannot: the UI writes attachments through the table draft `PUT`, not through
`POST /assets/{id}/attach`. MCP `bulk_attach` / `bulk_detach` go through the
broken path.

## 4. Why the tests did not catch it

`backend/tests/test_assets_registry.py:108-135` iterates every table key and
asserts a matching `ATTACHMENT_FIELDS` entry exists, with the right kinds,
content types, and counts. It never asks whether the row walker can *reach*
that field. **Registration was tested; reachability was not.**

The anonymous-access tests
(`backend/tests/test_assets_service.py:297,323`) exercise exactly one field —
`pumps.datasheet_asset_ids` — which happens to be on the working side of the
split.

That is the gap Phase 03 closes, and the probe in §6 is the test.

## 5. How the regression happened

- `2026-06-09` (`ffd138a8`) — Thermal Bridges gains
  `ThermalBridgesTableEnvelope`.
- `2026-06-17` (`a5a9a395`, "Complete data table consolidation") — the row
  walker is reworked; `thermal_bridges` keeps `_dict_rows(...)`.
- `2026-07-18` (`d6cc80cc`, "Implement documentation tab") — heat-pump table
  keys are added to the registry, wired with `_dict_rows` alongside the
  equipment keys that correctly use `attachment_table_rows`.

So the tables migrated to the `{field_defs, rows}` envelope as part of the
custom-fields work, and the attachment reader was updated for the equipment
family but not for Thermal Bridges or Heat Pumps. `pdf_report_asset_ids` is an
older, independent omission: it was hand-rolled with the generic
`built_in_field_def(...)` in
`backend/features/project_document/tables/thermal_bridges.py:79-83` instead of
going through the `_attachment_fields.py` helpers that pair a document column
with a registry entry.

## 6. The probe (lift this into Phase 03)

The script that produced §1. Kept verbatim so the guard test can be derived
from something already known to work. Ran as
`cd backend && uv run python <script>`.

```python
"""Probe: which registered attachment fields does list_asset_references reach?"""
import copy

from features.assets.registry import (
    ATTACHMENT_FIELDS,
    EQUIPMENT_ATTACHMENT_TABLE_KEYS,
    HEAT_PUMP_ATTACHMENT_TABLE_KEYS,
    iter_rows_for_raw_tables,
    list_asset_references,
)
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest

doc = empty_project_document(CreateProjectRequest(name="probe", bt_number="0000"))
tables = doc.model_dump(mode="json")["tables"]


def container_for(tables, table_key):
    """Return (parent, key) for the raw row container a table_key maps to."""
    if table_key in ("project_materials", "project_glazings", "project_frames", "thermal_bridges"):
        return tables, table_key
    if table_key in EQUIPMENT_ATTACHMENT_TABLE_KEYS:
        return tables.setdefault("equipment", {}), EQUIPMENT_ATTACHMENT_TABLE_KEYS[table_key]
    if table_key in HEAT_PUMP_ATTACHMENT_TABLE_KEYS:
        hp = tables.setdefault("equipment", {}).setdefault("heat_pumps", {})
        return hp, HEAT_PUMP_ATTACHMENT_TABLE_KEYS[table_key]
    return None, None


for field in ATTACHMENT_FIELDS:
    probe = copy.deepcopy(tables)
    asset_id = f"asset_probe_{field.key.replace('.', '_')}"

    if field.table_key == "assembly_segments":
        probe["assemblies"] = [{
            "id": "asm_probe", "name": "probe",
            "layers": [{"id": "lay_probe", "segments": [
                {"id": "seg_probe", "name": "s", field.field_key: [asset_id]},
            ]}],
        }]
    else:
        parent, key = container_for(probe, field.table_key)
        row = {"id": "row_probe", "name": "probe", field.field_key: [asset_id]}
        existing = parent.get(key)
        # Preserve the table's real envelope shape — this is the whole point.
        if isinstance(existing, dict) and "rows" in existing:
            parent[key] = {**existing, "rows": [row]}
        else:
            parent[key] = [row]

    class _Body:  # list_asset_references only calls .model_dump()
        def model_dump(self, mode=None):
            return {"tables": probe}

    refs = list_asset_references(_Body())
    hit = any(r["asset_id"] == asset_id for r in refs)
    rows_seen = len(iter_rows_for_raw_tables(probe, field.table_key))
    print(f"  {field.key:<45} {'FOUND' if hit else 'MISS':<6} rows_walked={rows_seen}")
```

**Caveat for whoever lifts this:** `container_for` and the assembly-segment
branch hand-encode the table→container mapping, mirroring the very if-chain
under test. That is acceptable for a probe but weak for a permanent guard —
Phase 03 should build the fixture from the table contract registry instead, so
the test and the code under test do not share an assumption. See
[phase-03](./phases/phase-03-reachability-guard.md) §"Independence".

## 7. Open questions carried into implementation

1. **Are there stored references that will fail the newly-enabled write
   validation?** Unknown until Phase 00 runs against production. This is the
   only real risk in the backend bundle.
2. **Have any Thermal Bridges / Heat Pump attachments already been swept?**
   Should be no — the sweeper is manual and dry-run by default — but Phase 00
   should confirm no asset row carries `orphaned_status: "moved"` with a
   reference from those tables.
3. **Should the table→rows mapping stay a hand-written if-chain at all?**
   Deriving it from the table contract registry would make this class of bug
   structurally impossible. Deliberately deferred out of the bug fix; noted in
   [phase-06](./phases/phase-06-closeout.md) as a follow-up candidate.
