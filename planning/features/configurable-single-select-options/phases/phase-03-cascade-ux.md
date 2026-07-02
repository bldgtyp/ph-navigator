---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Referenced-option delete and replacement behavior.
RELATED:
  - ../PLAN.md
  - ./phase-02-rooms-affordance.md
---

# Phase 03 - Cascade UX

## Goal

Handle deletion of options currently referenced by rows with explicit, tested
behavior.

## Scope

- Update `FieldConfigSectionOptions` so referenced deletes can choose clear or
  replacement when allowed.
- Carry replacement choices through `EditCustomFieldBundleRequest` and mutation
  builders if typed `editFieldBundle` remains the save path.
- Preserve backend required-field behavior: required built-ins must replace,
  nullable built-ins may clear if the product decision allows it.
- Show reference counts and replacement candidates from the draft option list.

## Tests

- Delete unused option succeeds without cascade choice.
- Delete in-use nullable Rooms option follows Phase 00 decision.
- Replacement delete rewrites row values to the replacement option id.
- Required built-in delete without replacement is blocked.
- Missing replacement candidate produces a user-facing error.

## Exit Criteria

- Referenced deletes no longer rely on accidental backend clearing or ad hoc
  whole-table replace behavior.
- The same cascade rules work from browser UI and direct schema mutation tests.
