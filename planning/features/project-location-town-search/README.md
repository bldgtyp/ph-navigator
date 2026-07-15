---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: In Progress
AUTHOR: Codex
SCOPE: Allow the Climate / Project Location search to resolve either a full
  street address or a town/state locality without persisting a false street
  address.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ./research.md
  - ./phases/phase-00-provider-contract-and-fixtures.md
  - planning/archive/dated/2026-06-22/climate-auto-populate/
  - planning/archive/dated/2026-06-13/project-location/
---

# Project Location Town Search

## Scope

Extend the Climate **Set project location** modal so an editor may search for
either:

- a full street address, or
- a town/locality plus state, with ZIP/postal code optional.

Selecting a locality stores the U.S. Census Gazetteer internal point as the
project coordinates while keeping `street_address = null`. Existing
city/state/postal storage and coordinate-driven Climate workflows are reused.
The locality path uses a versioned repository data file and requires no runtime
API key; full street addresses continue through the existing Census geocoder.

## Intended Outcome

A privacy-conscious client can be represented by a town-center map point rather
than a street-level point. Climate station selection, ASHRAE design-condition
lookup, sun-path data, county/state derivation, and climate-zone derivation
continue to consume the saved coordinates.

## Read Order

1. `PRD.md` - product, privacy, and behavior contract.
2. `decisions.md` - accepted data-source, persistence, and UI boundaries.
3. `research.md` - current-code and Census data findings.
4. `PLAN.md` - phase sequence and implementation seams.
5. `phases/phase-00-provider-contract-and-fixtures.md` - first implementation
   handoff.
6. `STATUS.md` - current state and next action.

## Classification

`planning/features` because this adds a user-visible Project Location
capability while preserving the existing Climate and project-location
architecture. It is not a cross-cutting refactor.

## Working Boundary

Phases 00-02 are complete: the repository contains the deterministic 2025
Census artifacts/importer, typed backend locality search with preserved Census
full-address fallback, and the modal query/persistence plus privacy UX. Phase 03
is integrated verification, durable-doc reconciliation, and closeout.
