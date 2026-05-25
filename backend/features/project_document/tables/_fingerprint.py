"""Stable schema fingerprint over a table's core + custom field shape.

Plan-13 §4.6 / plan-14 P1.5: persisted view state is sanitized per
the active table schema. The fingerprint is the matchkey — equal
fingerprints mean equal column identity sets, so a saved view state
can be re-applied. Renaming a custom field (which changes only
`display_name`) leaves the fingerprint stable; adding / removing /
retyping a field changes it.

Fingerprints are version-tagged via `FINGERPRINT_ALGORITHM_VERSION` so
a future algorithm change can be detected and treated as a mismatch
without colliding with old persisted fingerprints.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable

from features.project_document.custom_fields import CustomFieldDef

FINGERPRINT_ALGORITHM_VERSION = "v1"


def compute_table_schema_fingerprint(
    core_field_keys: Iterable[str],
    custom_fields: Iterable[CustomFieldDef],
) -> str:
    """Return a stable hex digest over a table's schema identity.

    The digest depends on:
      - the core field key tuple in declared order;
      - each custom field's `(id, field_type)` pair in stored order;
      - the algorithm version tag.

    It deliberately ignores `display_name`, `description`, and `config`
    so renames and description edits keep the persisted view-state
    record applicable (D13).
    """
    payload = {
        "version": FINGERPRINT_ALGORITHM_VERSION,
        "core": list(core_field_keys),
        "custom": [{"id": field.id, "field_type": field.field_type.value} for field in custom_fields],
    }
    encoded = json.dumps(payload, sort_keys=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
