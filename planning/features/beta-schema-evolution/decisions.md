---
DATE: 2026-06-27
TIME: 11:00 EDT
UPDATED: 2026-06-27 - added D6-D9 from the code-grounded readiness review follow-up.
STATUS: Active - decisions locked by Ed on 2026-06-27.
AUTHOR: Codex with Ed May
SCOPE: Accepted decisions for beta schema evolution.
RELATED:
  - ./README.md
  - ./PRD.md
  - planning/code-reviews/2026-06-27/beta-schema-evolution-readiness.md
  - context/technical-requirements/llm-mcp-schema.md
---

# Decisions

## D0 - Use a read-time forward-only upgrade chain. `RESOLVED: YES (Ed, 2026-06-27)`

Project document schema evolution will use a forward-only chain of pure upgrade
steps. A raw body saved under an older `schema_version` is upgraded in memory to
the current shape and then validated. The original saved row is not mutated on
read.

This carries forward the recommended mechanism from the 2026-06-27 review and
the earlier deferred Phase 7 plan.

Rejected default: deploy-time Alembic body rewrites for project document JSONB
bodies.

## D1 - When is beta data real? `RESOLVED: first actual BLDGTYP job (Ed, 2026-06-27)`

The first project created by someone other than the development agents for an
actual BLDGTYP job counts as real beta data and activates the forever-readable
guarantee.

Disposable local/demo/agent seed data does not activate the guarantee.

## D2 - How are old saved versions stored? `RESOLVED: keep old rows old (Ed, 2026-06-27)`

Old saved versions remain stored in their original schema. Reads upgrade them in
memory. The current schema is written only when saving a draft, save-as, or
performing an explicit manual repair.

This keeps immutable project-version semantics intact.

## D3 - Should DB body rewrites ever run? `RESOLVED: explicit maintenance only (Ed, 2026-06-27)`

A DB body rewrite is allowed only as an explicit maintenance operation with
export, audit, backup, and rollback. It is not the normal deploy path and not a
silent read side effect.

## D4 - Do we need a repair/import UI before beta? `RESOLVED: no (Ed, 2026-06-27)`

Raw JSON download plus a CLI repair/audit path is enough for early beta.

Add an importer or admin repair UI only if real beta recovery happens often
enough to justify product surface area.

## D5 - How strict are built-in display-name changes? `RESOLVED: built-ins are product schema (Ed, 2026-06-27)`

Built-in field display names are product schema when they come from code-defined
fields. Old persisted built-in display names should be migrated or overlaid when
the product label changes.

User-created custom field names must be preserved. The drift reporter must
distinguish built-in `origin` from custom/user-created fields before suggesting
changes. The persisted `TableFieldDef.origin` field
(`Literal["built_in", "custom"]`, `custom_fields.py`) already carries this
distinction, so the reporter classifies by `origin`, not by re-matching keys.

## D6 - How are drafts upgraded? `RESOLVED: drafts may be upgraded in place; versions may not (Ed, 2026-06-27)`

Drafts are crash-recovery cache (`save-versioning.md` §8.3), not immutable
saved versions. The "no DB mutation on read" rule in D2/D3 applies to
`project_versions`, not to `project_version_drafts`.

Therefore:

- A lazy draft created from an older saved version is snapshotted from the
  **upgraded** version body, so every subsequent JSON-Patch op targets the
  current shape.
- A draft row already persisted under an older `schema_version` is upgraded on
  read and may be **rewritten in place** (body + recomputed `draft_etag`) so
  patches never apply against a stale body shape.

This avoids the corruption hazard of applying current-shape patches to an
un-upgraded stored draft body. Saved versions still follow D2 (upgrade in
memory, never rewritten on read).

## D7 - Which body does the ETag describe after upgrade? `RESOLVED: the upgraded (current-shape) body (Ed, 2026-06-27)`

Version ETags are derived on the fly from the validated body
(`validation.py` `document_etag`), not stored on the row. With the upgrade seam
inside the validation funnel, the ETag returned for an older version describes
the **upgraded** body, not the stored bytes. No DB rewrite happens; this
refines the readiness-review phrasing "compare against the stored body."

Consequence accepted: deploying a new upgrade step or bumping `CURRENT` between
draft-open and Save shifts the derived ETag and surfaces as a 409 that forces a
reload. For a two-person sequential team this is rare and safe. The raw JSON
download (D9) remains the only surface that reflects stored bytes verbatim.

## D8 - Do we keep per-version Pydantic models? `RESOLVED: no - dict-to-dict steps only (Ed, 2026-06-27)`

Upgrade steps are pure `dict -> dict` functions; the body is validated only
against the **current** `ProjectDocument` model after all steps apply. We do
**not** maintain `ProjectDocumentV1`, `ProjectDocumentV2`, ... side by side.
This mirrors the existing catalog import/export upgrade precedent and keeps the
lane small.

This **supersedes `llm-mcp-schema.md` §10.5 item 9**. Phase 4's doc
reconciliation must edit item 9 to match, not merely re-label the mechanism
from "deferred" to "beta gate."

## D9 - Does raw JSON download get upgraded? `RESOLVED: no - raw stays raw (Ed, 2026-06-27)`

`GET .../download` (`routes.py` `get_raw_saved_document`) intentionally returns
the stored body un-upgraded as the recovery valve. Every other read path
(top-level document, table slices, draft, diff, MCP tools, envelope/PHPP/HBJSON
export) upgrades through the shared funnel. "Upgrade everywhere except raw
download" is the rule.

