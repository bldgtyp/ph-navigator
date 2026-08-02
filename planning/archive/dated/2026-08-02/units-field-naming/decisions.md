---
DATE: 2026-08-02
TIME: 18:46 EDT
STATUS: Accepted — implemented in the v8→v9 migration
AUTHOR: Codex during Ed May's requested implement-loop
SCOPE: Resolve the two field-naming choices left open by the PRD.
RELATED:
  - ./PRD.md
  - ./STATUS.md
---

# Decisions — units field naming

## D1 — Store every heat-pump capacity in canonical kW

**Decision:** Rename legacy `heating_btuh_17f` to
`heating_cap_kw_17f`, add the same fixed power metadata as the adjacent
capacity fields, and convert persisted v8 values using the exact factor
`1 kW = 3412.141633 Btu/h`.

**Reason:** One capacity contract is safer for UI, API, export, and agent
consumers. It eliminates the lone plain-number Btu/h exception while retaining
lossless-enough source precision for the existing numeric model.

## D2 — Name pump flow for its canonical SI storage

**Decision:** Rename `pumps.flow_gpm` to `flow_l_min`; preserve the persisted
numeric value unchanged.

**Reason:** The field already stores l/min and already carries a fixed
`l_min`/`gpm` units block. The explicit SI key matches the repository's
canonical-storage convention and the existing equipment field style.

## D3 — Ship FieldDef truthfulness atomically with schema v9

**Decision:** Include backend metadata, truthful labels, key renames, value
conversion, and persisted FieldDef refresh in one v8→v9 migration.

**Reason:** The schema fingerprint guard correctly rejects built-in FieldDef
changes without a version bump. A separate label/metadata-only change would
therefore violate the repository's schema-evolution contract.
