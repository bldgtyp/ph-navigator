---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Complete — private PR #1 squash-merged and films v1 published
  successfully 2026-07-28
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 1 — bootstrap the private `ph-navigator-data` repo, publisher, and CI.
RELATED: ../PRD.md §4–§5, ../decisions.md §D-3/§D-4, ../STATUS.md
---

# Phase 1 — Bootstrap `ph-navigator-data`

## Goal

A private repo where merging a reviewed PR *is* the publish event, proven by
a full drill against local MinIO with the ASHRAE surface-film dataset.

## Operator prerequisites (Ed, before agent code work starts)

1. ✅ **Done 2026-07-28** — private repo created: `bldgtyp/ph-navigator-data`
   (<https://github.com/bldgtyp/ph-navigator-data>), local clone
   `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data`.
2. ✅ **Done 2026-07-28** — Cloudflare Account API token
   **`ph-navigator-data-publisher`** (Object Read & Write, scoped to
   `ph-navigator-prod`), stored in the repo's Actions settings as secrets
   `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ACCOUNT_ID` plus the
   variable `R2_BUCKET` = `ph-navigator-prod`. Verified green by the
   **"Check R2 Credentials"** workflow (after one caught paste artifact — a
   trailing `.` in `R2_BUCKET`).

## Work

1. ~~**Repo skeleton**~~ ✅ **Done 2026-07-28** (commits `4321620`,
   `9b993d7`, `02e4f49`, `7332b86`, all pushed): `README.md`, `CLAUDE.md`
   (agent hard rules + credential-ops rule), `.gitignore`, empty
   `manifest.json`, `datasets/README.md` (the per-dataset contract), and the
   credential check (`tools/check_r2.py` + `.github/workflows/check-r2.yml`,
   incl. paste-artifact screening). This phase then added `tools/publish.py`
   and `.github/workflows/publish.yml` in private PR #1 (items 2–3).
2. **`tools/publish.py`** — standalone (boto3 + jsonschema, no PHN imports):
   - `--validate` (default in PRs): every `dataset.json` parses against its
     sibling `schema.json`; every manifest entry's `sha256` matches its file;
     changed content without a version bump fails (§D-4).
   - `--publish --target {r2,local}`: upload dataset objects for manifest
     entries not yet in the store (refuse differing overwrite, no-op on
     identical bytes), then upload `datasets/manifest.json` **last**.
   - Prints slugs/versions/checksums only — never values (AC 12).
3. **CI** (`publish.yml`): PR → validate; merge to `main` → validate then
   publish to R2. Concurrency-grouped so publishes serialize. Reads exactly
   the stored names — secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
   `R2_ACCOUNT_ID`, variable `R2_BUCKET` — the same way `check-r2.yml`
   already does (copy its `env:` block).
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

Passed 2026-07-28 on `ph-navigator-data:feat/licensed-data-pipeline`
(`b0bd933`), then squash-merged by private PR
[#1](https://github.com/bldgtyp/ph-navigator-data/pull/1) as `8d4baa1`:

- `python tools/publish.py --validate --base-ref main` — films v1 schema,
  key, checksum, and base-version contract valid.
- `python -m unittest discover -s tests` — 8 synthetic tests pass, including
  manifest-last order, interruption safety, idempotent republish, immutable
  overwrite refusal, sanitized schema errors, stable-slug enforcement,
  checksum rejection, and content/version coupling.
- Local MinIO drill — interruption preserved the previous manifest; a clean
  rerun completed; rollback repointed a later manifest to v1; both immutable
  objects remained.
- Licensed payload bytes were never printed; verification logs contain only
  slug, version, object key, byte count, and SHA-256.

Hosted PR validation and the first `main` publication both passed. Actions run
`30418485049` uploaded the immutable films object and swapped the production
manifest last. The private feature branch was removed locally and remotely
after tree-equivalence verification.
