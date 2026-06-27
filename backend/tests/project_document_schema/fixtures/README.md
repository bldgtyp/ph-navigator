# Project Document Schema Fixtures

These JSON files are frozen project-document schema artifacts. Tests load the
`inputs/` bodies as raw JSON and compare upgraded output to the committed
`expected/` snapshots byte-for-byte.

Do not regenerate an old fixture from current factories after a schema bump. Add
a new fixture for the old shape being changed, then commit the expected upgraded
snapshot produced by the reviewed migration step.
