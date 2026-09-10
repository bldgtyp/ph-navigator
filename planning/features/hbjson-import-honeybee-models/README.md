---
DATE: 2026-09-10
TIME: 12:42 EDT
STATUS: Implemented on branch (2026-09-10)
AUTHOR: Claude (with Ed May)
SCOPE: Router for the packet that makes a real honeybee `Model` HBJSON importable on Envelope → Assemblies
RELATED: context/technical-requirements/envelope-hbjson-import.md, context/technical-requirements/envelope-hbjson-export.md, planning/archive/envelope-hbjson-import/
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/92
---

# HBJSON import: honeybee `Model` files (PH-Navigator for SketchUp)

Issue [#92](https://github.com/bldgtyp/ph-navigator/issues/92) asks for one
fallback read: take a construction's `ph_nav` block from `user_data["ph_nav"]`
as well as from the top-level `ph_nav` key, so an HBJSON written by
**PH-Navigator for SketchUp** imports its membranes.

Testing the real SketchUp export against the current importer (2026-09-10,
three host-gate artifacts from `ph-navigator-sketchup`) found that the
`ph_nav` location is the third of four blockers, and the file is rejected
before the block is ever read. This packet covers all four, because fixing
only the filed one changes nothing a user can see.

## Read order

1. [`PRD.md`](PRD.md) — the four gaps with their evidence, the behavior
   contract, and the open decisions.
2. [`PLAN.md`](PLAN.md) — implementation sequence, files, tests, verification.
3. [`STATUS.md`](STATUS.md) — current state and next step.

## Scope in one line

Teach the **foreign** (raw honeybee) branch of `parse_construction_library`
to read what honeybee actually writes: abridged constructions resolved
against the model's material list, honeybee-PH's own division-cell shape,
`ph_nav` from `user_data`, and a no-mass layer that skips one construction
instead of failing the file. No change to any PH-Navigator export.
