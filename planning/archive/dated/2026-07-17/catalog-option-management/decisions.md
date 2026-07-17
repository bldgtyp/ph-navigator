# Decisions — Catalog Option Management

DATE: 2026-07-17
TIME: 12:07
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Accepted and open decisions for this feature.
RELATED: PRD.md, research.md

## Accepted

### D-1 — Authorization: `catalog.edit` becomes a member capability
Add `CATALOG_EDIT` to `MEMBER_CAPS` (`backend/features/access/capabilities.py:74`).
This matches Ed's requirement "logged in, not Certifiers" exactly: certifier
audience resolves to zero capabilities (fails closed), client viewers get
`CLIENT_CAPS` (read-only). Consequence accepted: members can also edit catalog
*rows*, not just options — aligned with how the firm uses shared catalogs.
Alternative rejected: a separate `catalog.options.edit` capability (more
surface, no current need for the split).
*Status: confirmed by the 2026-07-17 implement-loop kickoff; implemented in
Phase 1.*

### D-2 — Rename cascades project-wide via heavy rewrite + working modal
Ed, 2026-07-17: "on re-name we can handle heavy re-write (with a good
'working' modal). Rename is pretty infrequent, so doing it properly once or
twice a year seems ok." So: async backend job rewrites project
`ManufacturerFilters` entries and label-matching snapshot ref fields; progress
modal in the catalog UI. The modal previews the exact active-project count,
mounts only after the field editor closes, and recovers an unresolved job after
a catalog-page remount. Alternatives rejected: (a) tolerant/ID-based filter
matching (leaves stale strings in documents forever), (b) leaving renames to
per-ref drift resolution (tedious for a pure relabel, and filters would still
orphan).

### D-3 — Merge (delete-in-use) does NOT rewrite project refs
Rename = same entity relabeled → silent cascade (D-2). Merge = identity
collapsed into another option → a real data change, so refs go through the
existing drift/Refresh review instead. Project *filters* are still cascaded on
merge (an orphaned allow-list entry is never useful). If this split proves
confusing in practice, promoting merge to full cascade is a small delta.

## Settled during Phase 2

### O-1 — System-authored version identity
The appended version is named by the system (`Catalog rename: <old> → <new>`)
but authored by the member who triggered the catalog edit. This preserves the
normal `created_by` audit trail without inventing a reserved user.

### O-2 — Cascade vs. someone's open draft
Rewrite every draft attached to the current active version, including drafts
owned by other editors, and advance their draft ETags. Existing optimistic
writes then fail with the normal `draft_etag_mismatch` 409 and refetch path;
historical-version drafts are deliberately untouched.

### O-3 — Job infrastructure reuse
A dedicated catalog-scoped job plus per-project result table is cleaner than
the existing project-scoped asset job. `PUT /options` creates the durable job
in its option-write transaction; a background runner updates progress; a
catalog-editor status/retry API exposes it to Phase 3. A five-minute heartbeat
lease turns a killed worker into a retryable failure rather than blocking all
later option edits.
