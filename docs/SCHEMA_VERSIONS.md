# Project Document Schema Versions

Running log of `ProjectDocumentV1.schema_version` bumps. Pre-deploy
project (CLAUDE.md §16): bumps are one-shot reshapes, no shim chain.

| Version | Date | Plan | Change |
|---------|------|------|--------|
| 1 | — | — | Initial shape. `tables.<name>` is `Row[]`. |
| 2 | 2026-05-24 | plan-14 P1.1 | Adds `{custom_fields, rows}` envelope to custom-field-capable project-document tables (Rooms in P1.1; ERVs/Pumps/Fans/Thermal Bridges in plan-13 phase 5). Adds sparse `custom: dict` on `RoomRow`. Pre-deploy, no shim chain (CLAUDE.md §16). |
