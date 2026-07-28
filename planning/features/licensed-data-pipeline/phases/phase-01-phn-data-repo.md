---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Planned
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 1 — bootstrap the private `phn-data` repo, publisher, and CI.
RELATED: ../PRD.md §4–§5, ../decisions.md §D-3/§D-4, ../STATUS.md
---

# Phase 1 — Bootstrap `phn-data`

## Goal

A private repo where merging a reviewed PR *is* the publish event, proven by
a full drill against local MinIO with the ASHRAE surface-film dataset.

## Operator prerequisites (Ed, before agent work starts)

1. Decide Q-1 and create the private repo under `bldgtyp` (working name
   `phn-data`).
2. Mint a bucket-scoped R2 API token (write) and add it to that repo's
   Actions secrets (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
   `R2_ACCOUNT_ID`, bucket name as a variable).

## Work

1. **Repo skeleton** per `PRD.md` §4: `README.md` (what this is, private-
   forever licensing posture, how to add a dataset), `manifest.json`,
   `datasets/`, `tools/publish.py`, `.github/workflows/publish.yml`.
2. **`tools/publish.py`** — standalone (boto3 + jsonschema, no PHN imports):
   - `--validate` (default in PRs): every `dataset.json` parses against its
     sibling `schema.json`; every manifest entry's `sha256` matches its file;
     changed content without a version bump fails (§D-4).
   - `--publish --target {r2,local}`: upload dataset objects for manifest
     entries not yet in the store (refuse differing overwrite, no-op on
     identical bytes), then upload `datasets/manifest.json` **last**.
   - Prints slugs/versions/checksums only — never values (AC 12).
3. **CI** (`publish.yml`): PR → validate; merge to `main` → validate then
   publish to R2. Concurrency-grouped so publishes serialize.
4. **First dataset: `datasets/ashrae-surface-films/`** — payload
   byte-compatible with `parse_surface_film_payload`'s existing format,
   sourced from Ed's Dropbox master (the same values already published to
   production on 2026-07-28). `schema.json` + `PROVENANCE.md` (ASHRAE HoF
   2017 Ch. 26, license note). Manifest entry at version `"1"`.
5. **MinIO drill** (from a local checkout, `--target local`):
   - clean publish → manifest + object present, checksums match;
   - **interrupted-publish drill** (AC 4): kill between object and manifest
     upload → readers' manifest untouched; re-run completes cleanly;
   - **rollback drill** (AC 5): publish a v2, revert the manifest entry to
     v1, republish → manifest points at v1, both objects remain.

## Out of scope

PHN-side code (Phase 2); production R2 (Phase 3); any second dataset.

## Verification

The three drill outcomes above, plus: a deliberately corrupted
`dataset.json` fails `--validate`; a content edit without a version bump
fails `--validate`; CI green on the repo's first PR.
