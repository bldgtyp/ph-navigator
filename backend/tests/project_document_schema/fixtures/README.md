# Project Document Schema Fixtures

These JSON files are frozen project-document schema artifacts. Tests load the
`inputs/` bodies as raw JSON and compare upgraded output to the committed
`expected/` snapshots byte-for-byte.

Do not regenerate an old fixture from current factories after a schema bump. Add
a new fixture for the old shape being changed, then commit the expected upgraded
snapshot produced by the reviewed migration step.

`v7/inputs/mixed_specification_statuses.json` is the frozen baseline for the
v7 → v8 specification-status rename. Each of the three lists that carry a typed
built-in status — `project_materials`, `project_glazings`, `project_frames` —
holds one row per status, with the legacy `missing` first, so the committed
diff against `expected/` is exactly `schema_version` plus those three values.
A v7 body already carrying `needed` is covered by a focused upgrader unit test
instead: `needed` was never a legitimate persisted v7 value, so admitting one
here would misrepresent the baseline.
