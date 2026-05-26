"""Stable schema fingerprint over a table's persisted FieldDef shape.

v3: the fingerprint covers every persisted `TableFieldDef` (built-in
plus custom) keyed by `(field_key, field_type)`. Plan-13 §4.6 /
plan-14 P1.5 / plan-31 Phase 1b §P4.5: persisted view state is
sanitized per the active table schema. The fingerprint is the matchkey
— equal fingerprints mean equal column identity sets, so a saved view
state can be re-applied.

Renaming a field's `display_name` leaves the fingerprint stable;
adding / removing / retyping a field changes it.

Fingerprints are version-tagged via `FINGERPRINT_ALGORITHM_VERSION` so
a future algorithm change can be detected and treated as a mismatch
without colliding with old persisted fingerprints.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable

from features.project_document.custom_fields import TableFieldDef

# Bumped at Phase 1b cutover: the fingerprint payload shape changed
# (built-in entries now flow through alongside customs).
FINGERPRINT_ALGORITHM_VERSION = "v2"


def compute_table_schema_fingerprint(field_defs: Iterable[TableFieldDef]) -> str:
    """Return a stable hex digest over a table's schema identity.

    The digest depends on:
      - each persisted FieldDef's `(field_key, field_type)` pair in
        stored order;
      - the algorithm version tag.

    It deliberately ignores `display_name`, `description`, `default`,
    `origin`, and `config` so renames and description edits keep the
    persisted view-state record applicable (D13).
    """
    payload = {
        "version": FINGERPRINT_ALGORITHM_VERSION,
        "fields": [{"field_key": f.field_key, "field_type": f.field_type.value} for f in field_defs],
    }
    encoded = json.dumps(payload, sort_keys=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
