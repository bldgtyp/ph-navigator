---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Active — D-1 confirmed by Ed; Q-1/Q-2 resolved
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Options analysis, design decisions, edge cases, and open questions for
  the licensed-data pipeline.
RELATED: ./PRD.md, ./README.md, ./STATUS.md
---

# Decisions, interrogation, and open questions

## Part 1 — The options (why A)

The problem, stated by Ed 2026-07-28: the ASHRAE surface-film values were
published by running a seed script in a Render shell. "This manual approach
isn't appropriate or good for long-term maintenance… one way or another, I
don't want to have to manually add data for these types of things."

What exists today is the *distribution and read* half of a pipeline —
`DATA_STORAGE.md` class ④ (private R2/MinIO), `surface_film_store.py`,
`climate/object_store.py`, and per-dataset seed CLIs. What's missing is
upstream and downstream of the bucket: a versioned source of truth (today:
loose files in Dropbox), an automated publish path (today: an operator in a
shell), and an applied-state record (today: a git commit message saying
"Record the ASHRAE film table as published").

| Option | Shape | Verdict |
| --- | --- | --- |
| **A. Private git repo → CI → R2** | `ph-navigator-data` holds reviewed, versioned JSON; its Actions validate + publish to R2; app keeps reading only R2 | ✅ **chosen (Ed, 2026-07-28).** History, PR review, schema gates, automated publish, rollback-by-revert — and zero change to the app's runtime posture. Private repos are free; R2 already exists. |
| **B. Keep Dropbox masters, fix the tooling** | Point the existing seed CLIs at prod R2 from a laptop with a scoped write token | ❌ Fixes the Render-shell pain (an afternoon of work) but not the disease: no history, no review, no schema gate, "what's published" only discoverable by listing a bucket. Under-builds for a growing set of licensed tables. |
| **C. App consumes the private repo directly** | Submodule / raw-URL fetch / private package at deploy or runtime | ❌ Puts a GitHub token in Render, adds GitHub as a runtime availability dependency, and breaks the "Postgres owns references, object store owns bytes" boundary for no gain. |

A also subsumes B's one virtue: `tools/publish.py` runs identically from CI
and from Ed's laptop (against MinIO), so the manual path survives as the local
dev story rather than as the production process.

## Part 2 — Design decisions

### D-1. Source of truth = private git; distribution = R2; app reads only R2 ✅ decided (Ed, 2026-07-28)

The three-role split above. The load-bearing property: **production never
gains a GitHub dependency and never gains write access to the bucket.** The
blast radius of a compromised `ph-navigator-data` token is "bad data published" — which
the manifest/versioning makes visible and revertible — not "app compromised".

### D-2. Split by license, not by kind — ALL-seeds-move rejected ✅

Ed asked whether *all* seed data should move out. No: `backend/seeds/*`
(synthetic and own data — the 408-row materials catalog, aperture seeds) earns
its in-repo place with a zero-credential local-dev, agent, and test story.
Moving it buys no licensing protection and costs every workflow a credential.
The Hillandale incident already taught the converse lesson (licensed data
in-repo); this is the same rule applied in both directions. What *is* unified
is tooling: the registry doesn't care where a dataset's bytes originated.

### D-3. The publisher lives in `ph-navigator-data`, standalone ✅

`tools/publish.py` is boto3 + jsonschema with no PHN import. Rationale:
- `ph-navigator-data` CI stays self-contained (no PHN checkout, no uv env, fast).
- PHN never contains a publish code path, so it can never be run with write
  credentials by mistake — the read/write split is structural, not
  disciplinary.
- Cost: the manifest shape is defined in two repos. Accepted — it is ~10
  lines of JSON contract, and PHN's reader validates it anyway.

### D-4. Immutable versioned keys + manifest-last + bump-on-change CI gate ✅

The three invariants in `PRD.md` §5. Together they give: interrupted publishes
are harmless (old manifest intact), rollback is a PR revert (old objects
remain), and content can never drift under a version label (CI compares
`sha256` against the committed manifest). The committed `manifest.json` — not
the bucket — is the source of truth; the published copy mirrors it.

### D-5. Production apply trigger — workflow → Render one-off job ✅

For `db_seed` datasets. Candidates:

| Option | Assessment |
| --- | --- |
| **Manual-dispatch GH workflow → Render API one-off job** | ✅ **selected for implementation in Phase 3 (2026-07-28).** Runs `datasets_apply` in the API service's own environment — right DB URL, right R2 creds, no config duplication. One new secret (`RENDER_API_KEY`). Same explicit-human-event doctrine as "Deploy Production". |
| GH Actions → direct prod Postgres (scoped writer role) | Viable — `backup-db.yml` proves the connectivity pattern — but duplicates app config outside the app and parks DB *write* credentials in a second system. Fallback if Render jobs prove awkward. |
| Authenticated admin endpoint | ❌ A web endpoint that mutates the catalog is auth surface and blast radius for a task with zero interactivity requirements. |
| Auto-apply at startup | ❌ Slow, surprising, couples deploys to data changes, violates "deploys are explicit" in spirit. |

### D-6. Same bucket, `datasets/` prefix; write token only in `ph-navigator-data` ✅

No second bucket: the app already has read credentials for this one, and the
data classes (`DATA_STORAGE.md` §class ④) already cohabit. R2 API tokens scope
per-bucket, not per-prefix — accepted; the publisher's own refuse-to-overwrite
invariant is the guard against a misconfigured run touching other prefixes'
semantics (it only ever writes under `datasets/`).

**As wired 2026-07-28**: Cloudflare Account API token
`ph-navigator-data-publisher` (Object Read & Write → `ph-navigator-prod`
only); repo Actions secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
`R2_ACCOUNT_ID`; variable `R2_BUCKET` = `ph-navigator-prod`. Verified green
by the "Check R2 Credentials" workflow. Every future script and workflow uses
these names verbatim.

### D-7. Local dev publishes from a checkout; agents get synthetic fixtures ✅

Two distinct audiences, two answers. Ed/John: `make datasets-publish-local` →
`tools/publish.py` against MinIO from a local `ph-navigator-data` checkout. Agents and
CI: **never** — synthetic fixtures (film-store precedent, `b869a8fc`) and
typed-unavailable states are the contract, and no test may require licensed
data. This keeps the public repo's CI green for anyone, with zero secrets.

### D-8. Climate bundles grandfathered; films migrate now ✅

The films key (`standards/<standard>/surface_films.json`) is **unversioned** —
no history, no rollback — and the dataset is one small JSON object: the ideal
first migration. Climate bundles are already versioned by `(provider,
version)`, are large, change rarely, and their build step
(`processing.build_bundle`) lives in PHN — migrating them means either moving
the build into `ph-navigator-data` or committing built artifacts. Defer to when a new
climate release next forces the question; the pipeline's layout
(`datasets/<slug>/<version>/`) deliberately mirrors theirs so the move is
mechanical later.

### D-11. Method parameters stay in code — the line, stated ⚠️ Ed ratifies

There is a de facto line the repo has already drawn twice and never named:
**small constant sets integral to implementing a standard live in code**
(the ISO 6946 film table; next, the condensation engine's psat coefficients,
δ₀, ISO 13788 occupancy RH ramps and humidity-class Δp — all already quoted
in that feature's committed planning docs), while **bulk data tables route
through the private store** (ASHRAE films, ISO 10456 µ, climate bundles).

The distinction is defensible — you cannot implement a method without its
parameters, and a handful of constants in standards-implementing code with a
citation is normal practice everywhere — but it *is* a judgment call about
licensed sources, and it should be a ratified decision rather than drift.
The practical test used so far: **if the values fit legibly in the
implementing function's docstring-adjacent code and are already quoted in a
committed planning doc, they are method parameters; if they are a table you
would paginate, they are data.** → Ed ratifies (or redraws) the line; the
`PRD.md` §3a inventory applies it dataset by dataset.

### D-9. Two dataset kinds, explicit in the registry ✅

`runtime_read` (fetched at serve time, cached, cache-reset hook, typed
unavailable error) vs `db_seed` (explicit idempotent apply, `applied_datasets`
audit row). The distinction matters operationally: a `runtime_read` publish
takes effect on cache reset/restart with **no apply step**, while a `db_seed`
publish does nothing until someone applies it — `datasets_status` must show
"published but not applied" loudly, or the pipeline recreates the silent-drift
problem it exists to kill.

### D-10. `db_seed` appliers need stable row identity — interaction with `catalog-seed-idempotency` ⚠️

The µ applier (Phase 4) updates existing `catalog_materials` rows, which
requires a reliable match key. The completed
`planning/archive/dated/2026-07-28/catalog-seed-idempotency/` refactor gives
every canonical seed row a deterministic id derived from catalog kind + name.
The µ dataset must key on that same identity (and say so in its
`PROVENANCE.md`); the former row-identity risk is resolved, while the applier
still needs to report unmatched rows explicitly.

## Part 3 — Edge cases

| # | Case | Handling |
| --- | --- | --- |
| E-1 | Publish dies mid-run | Manifest uploads last; readers keep serving prior versions. Re-running CI is safe (identical-bytes republish is a no-op). Drilled in Phase 1 (AC 4). |
| E-2 | Attempt to overwrite a published version with different bytes | Publisher hard-errors. The fix is a version bump in the PR, never a force flag — there is no force flag. |
| E-3 | Rollback | Manifest revert by PR (objects remain). Drilled in Phase 1 (AC 5). For an applied `db_seed` dataset, rollback additionally means applying the older version (appliers set absolute values, so re-apply is the undo). |
| E-4 | Manifest entry with no registry spec (data ahead of code) | `datasets_status` warns; `datasets_apply --all-pending` skips unknown slugs. Normal during rollout windows. |
| E-5 | Registry spec with nothing published (code ahead of data) | Typed unavailable (the films 409 precedent) for `runtime_read`; status flags it; apply errors per-slug. Never a silent fallback. |
| E-6 | Fetched object's sha256 ≠ manifest | Hard typed error on both read and apply paths (integrity, AC 8). |
| E-7 | Fresh dev MinIO is empty | Boots and passes CI with typed-unavailable states; `make datasets-publish-local` is the fix, documented where the film-store unavailability is. |
| E-8 | R2 outage at runtime | `runtime_read` keeps serving its in-process cache; a cold start surfaces the typed unavailable error. Same posture as today's film store. |
| E-9 | Concurrent applies | Workflow `concurrency` serializes production; `UNIQUE(slug, version)` upsert makes a race harmless anyway. |
| E-10 | `db_seed` target rows missing/renamed at apply time | Applier reports per-row outcomes in its `ApplyReport` (matched / updated / unmatched); unmatched rows are a loud warning, not a silent skip. See D-10. |
| E-11 | Token leak from `ph-navigator-data` CI | Bucket-scoped; rotate in Cloudflare + repo secret. Damage bounded to bad publishes, which the manifest history makes enumerable and revertible. |
| E-12 | `ph-navigator-data` accidentally made public | Process guard only (README warning, repo description, private-forever policy); no technical guard exists. The values would then be a license violation to distribute — same posture as the Dropbox masters today, with better auditability. |
| E-13 | Very large future datasets (climate-scale) | Out of v1 scope (D-8). The key layout already accommodates them; revisit CI limits and git-LFS then. |

## Part 4 — Open questions

| # | Question | State |
| --- | --- | --- |
| Q-1 | **Repo name.** | ✅ **Resolved 2026-07-28** — `bldgtyp/ph-navigator-data`, created by Ed; local clone `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data`. Bootstrap commit (README, CLAUDE.md, .gitignore, empty manifest, `datasets/` contract) landed the same day. |
| Q-2 | **Apply trigger** — confirm D-5's Render-one-off-job recommendation. | ✅ **Resolved 2026-07-28** — the packet implementation uses manual-dispatch GitHub Actions → Render one-off job, with deployed-SHA and production guards. |
| Q-3 | Should heavy *non-licensed* artifacts (e.g. the local-only Hillandale fixture, census locality builds) ride the same pipeline later? | Non-blocking; v1.1 discussion. Nothing in v1 precludes it. |
| Q-4 | Version format — integers vs dates? | Recommend plain monotonic integers (`"1"`); dates encode nothing the manifest's `generated_at` and git history don't already carry. Non-blocking. |
