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
*Status: recommended in the 2026-07-17 session review; Ed approved the packet
built on it — re-confirm at Phase 1 kickoff before touching capabilities.*

### D-2 — Rename cascades project-wide via heavy rewrite + working modal
Ed, 2026-07-17: "on re-name we can handle heavy re-write (with a good
'working' modal). Rename is pretty infrequent, so doing it properly once or
twice a year seems ok." So: async backend job rewrites project
`ManufacturerFilters` entries and label-matching snapshot ref fields; progress
modal in the catalog UI. Alternatives rejected: (a) tolerant/ID-based filter
matching (leaves stale strings in documents forever), (b) leaving renames to
per-ref drift resolution (tedious for a pure relabel, and filters would still
orphan).

### D-3 — Merge (delete-in-use) does NOT rewrite project refs
Rename = same entity relabeled → silent cascade (D-2). Merge = identity
collapsed into another option → a real data change, so refs go through the
existing drift/Refresh review instead. Project *filters* are still cascaded on
merge (an orphaned allow-list entry is never useful). If this split proves
confusing in practice, promoting merge to full cascade is a small delta.

## Open (settle during implementation)

### O-1 — System-authored version identity
When the cascade lands on a project with no draft, who is the author of the
appended version? Options: a reserved system user, or the member who triggered
the rename. Leaning: the triggering member (keeps audit honest, no new
infrastructure). Check what `saved_by` / version metadata requires.

### O-2 — Cascade vs. someone's open draft
The cascade rewrites a draft owned by another editor (etag bump mid-edit).
Confirm the draft-save flow tolerates an external etag advance gracefully
(client refetch on 409/412), or scope the cascade to skip actively-locked
drafts and report them in the summary.

### O-3 — Job infrastructure reuse
A jobs mechanism exists (`get_job` MCP tool / extraction jobs). Confirm it fits
a multi-project fan-out with per-project progress, or whether a simple
dedicated table + polling endpoint is cleaner.
