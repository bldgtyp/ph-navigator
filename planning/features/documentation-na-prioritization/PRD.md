---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — behavior contract ready
AUTHOR: Ed May / Codex
SCOPE: Product contract for fully N/A Documentation records
RELATED:
  - planning/features/documentation-na-prioritization/README.md
  - planning/features/documentation-na-prioritization/STATUS.md
---

# PRD — Documentation N/A Prioritization

## 1. Definitions

A record is **fully N/A** only when all three axes are N/A:

- `spec_status === "na"`;
- `datasheet_status === "na"`;
- `photo_status === "na"`.

Define this once as a named helper. Do not scatter checks that happen to rely on
Spec N/A currently forcing the other axes in the UI.

## 2. Logged-in behavior

For each expanded **Envelope Assembly** Documentation group:

- preserve the incoming relative order of all non-N/A records;
- render non-N/A records first in the existing `documentation-grid`;
- collect every fully N/A record into one **Not applicable** section at the
  bottom of that same group;
- preserve the incoming relative order inside Not applicable;
- keep the current muted N/A row styling;
- collapse the Not applicable section by default and show its record count;
- expanding/collapsing the parent group resets no persisted evidence state;
- locked editors and authenticated read-only users see the same grouping.

The section is information hierarchy, not a new stored group. It must not alter
the backend record/group schema or rewrite material order.

When a `?needs=` attention filter is active, fully N/A records do not match and
the Not applicable section is omitted. Clearing the filter restores it.

Attention matching reads the requested raw axis independently. For example,
`spec_status="na"` plus `datasheet_status="needed"` must still match
`?needs=datasheet`; `axisDone()` must not let Spec N/A suppress an explicitly
Needed evidence axis. This changes filtering semantics only, not status values
or persistence.

The Not applicable disclosure is local view state keyed by Assembly group. It
starts collapsed, survives closing/reopening its parent during the mounted
page, and resets on page remount; it is never persisted to the Project.

## 3. Anonymous behavior

- Do not render fully N/A record rows.
- Do not render the Not applicable section or its count.
- If removing fully N/A records leaves a group empty, omit that group rather
  than showing an empty disclosure.
- If all Envelope groups disappear, omit the Envelope section rather than
  rendering its heading with an empty state.
- Do not expose hidden record labels in accessible text, DOM data attributes,
  or client-side hidden markup.
- This is a presentation filter over the authorized Documentation response; it
  does not change attachment authorization or evidence data storage.

Anonymous means no authenticated session. Do not use
`project.access_mode === "viewer"` alone unless the current access model proves
that it uniquely means anonymous; preserve authenticated read-only behavior.
Resolve identity with `useSessionQuery()` above the group boundary and pass an
explicit audience policy down. While the session is loading, or if it fails,
use the anonymous-hidden policy so N/A labels never flash before authentication
is known.

## 4. Counts and statuses

- Do not recompute or mutate saved evidence status.
- Existing progress denominators and complete/needed rollups remain the source
  of truth. N/A continues to satisfy its axis under the accepted status contract.
- The parent group/section rollup remains accurate and does not gain a second
  denominator based only on visible rows.
- Upload still auto-sets Datasheet/Photo to Complete, while manual Needed with
  an attachment remains valid.

## 5. Acceptance

- Mixed Assembly records render actionable items first and one collapsed
  Not applicable section last for a signed-in editor.
- Expanding Not applicable reveals only fully N/A rows with current muted style.
- Locked/authenticated read-only users retain that section.
- Anonymous users receive no fully N/A row or Not applicable section in the DOM.
- Anonymous groups containing only fully N/A records disappear cleanly.
- Active attention filters suppress fully N/A records for all users; a
  partially N/A record still matches any raw axis that is explicitly Needed.
- Parent rollups remain identical before/after this presentation change.
- Record detail and How to photograph modals remain available for visible
  records and otherwise unchanged.

## 6. Non-goals

- Changing the evidence-status vocabulary or persistence model.
- Automatically setting records to N/A.
- Reordering stored materials or Assembly layers.
- Hiding partially actionable records with only one or two N/A axes.
- Reordering N/A records in Equipment or other Documentation sections; those
  sections are unchanged until separately requested.
