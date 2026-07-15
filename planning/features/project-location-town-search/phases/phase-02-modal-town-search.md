---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implement address-or-town modal UX and correct persistence semantics.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
  - ./phase-01-backend-locality-candidates.md
---

# Phase 02 - Modal Town Search

## Goal

Allow editors to search and save a town-level location while keeping the
geocoder query separate from persisted street-address data.

## Implementation

1. Add modal-local `searchQuery` state.
   Add the frontend helper/modal regression tests first and observe the expected
   red assertions before changing behavior.
2. Initialize it after location load from `location.full_site_address` when
   available; do not overwrite in-progress typing on query refetch.
3. Send `searchQuery.trim()` to the geocode mutation.
4. Update label, placeholder, subtitle, locality note, and zero-result copy.
5. Show enough candidate information to distinguish address and town results.
6. Update candidate application:
   - address -> normalized street/city/state/postal + coordinates;
   - locality -> empty street + normalized locality fields + coordinates;
   - missing candidate address components -> empty/null persisted fields, never
     values retained from the previous location;
   - selected `candidate.label` -> search display only.
7. Ensure locality selection clears a previously loaded street address.
8. Preserve elevation auto-fill, manual override, pin refinement, validation,
   save enablement, and close behavior.
9. Track a modal-session presentation state so moving the pin stops displaying
   the selected point as town-level. Warn that refined coordinates are saved and
   shown on the project map.
   Direct latitude/longitude edits set the same custom-point state. Selecting a
   new locality candidate resets it to town-level; initial/reopened saved data
   uses neutral wording because precision is not persisted.

## State Ownership Rule

`searchQuery` belongs to `SetLocationModal`; normalized persisted address pieces
remain in `useProjectLocationForm`. Do not add display-only query state to the
API payload or database model.

## Tests

Form helper:

- locality candidate clears street and applies city/state/postal;
- address candidate remains unchanged;
- locality candidate clears an existing saved street;
- locality candidate clears stale city/state/postal components that the new
  candidate does not supply;

Modal:

- town/state/ZIP query is posted exactly as typed after trim;
- selecting locality keeps its label in the search input;
- save PUT contains `street_address: null` when replacing an existing address;
- city/state/postal and coordinates are included as needed;
- no-match copy remains address-or-town oriented and does not claim a street is
  required;
- Census address failure renders the existing actionable error path;
  `geocoder_unavailable` tells the editor to retry or set coordinates manually;
- elevation auto-fill still runs from locality coordinates;
- reopening an existing town-only location shows city/state/postal text;
- late query/refetch does not overwrite in-progress `searchQuery` typing;
- pin refinement replaces the town-level note with the custom-pin privacy note;
- direct latitude/longitude edits activate the same custom-point privacy copy;
- selecting a new locality after a custom edit restores town-level copy;
- reopening uses neutral saved-point copy rather than inferring resolution;
- standalone postal-code-area results are absent from candidate rows;
- mixed address/locality candidates are visibly distinguishable.

## Verification

```bash
cd frontend
pnpm exec vitest run \
  src/features/projects/__tests__/location-form.test.ts \
  src/features/climate/__tests__/SetLocationModal.test.tsx
pnpm exec tsc --noEmit
```

Then run `make frontend-dev-check` before live browser work.

## Exit Criteria

- A town candidate can be selected and saved with `street_address = null`.
- A previous street does not survive switching to town-only.
- Full-address save behavior remains green.
- The UI accurately describes the approximate Census locality internal point.
- Search-query initialization/reopen behavior is deterministic and covered.
- Custom-point privacy state transitions are deterministic and covered.
