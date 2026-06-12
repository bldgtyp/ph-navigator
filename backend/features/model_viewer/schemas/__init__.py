"""Wire schemas for the Model Viewer `/model_data` payload (US-VIEW-7).

Ported from V1 (`ph-navigator/backend/features/hb_model/schemas/`), split
by upstream library as V1 did. Field names are the frontend loaders'
contract — no renames vs. V1 (US-VIEW-7 crit. 8). Deltas vs. V1:

- Airflow is SI canonical: m³/s on the wire (US-VIEW-7 crit. 1).
- Constructions carry all four thermal fields (D-12).
- `load_summary` is new (US-VIEW-7 crit. 3).
- Duct elements/segments are typed (V1 shipped raw dicts).
"""

from features.model_viewer.schemas.combined import CombinedModelDataSchema, LoadSummarySchema

__all__ = ["CombinedModelDataSchema", "LoadSummarySchema"]
