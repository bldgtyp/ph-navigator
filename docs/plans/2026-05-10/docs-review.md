0---
DATE: 2026-05-10
TIME: 21:40 EDT
STATUS: Pre-implementation docs review. Findings only — no doc changes
        applied. Use this as a punch list before writing the vertical-slice
        phasing plan.
AUTHOR: Ed May (with Claude)
SCOPE: Comprehensive review of `context/` (PRD, TECH_STACK, GLOSSARY,
       DATA_TABLE, UI_UX, USER_STORIES, ENVIRONMENT, README) plus
       `docs/REMOVED.md`, `AGENTS.md`, `CLAUDE.md`, top-level `README.md`.
       Looks for conflicts, ambiguities, under-specification, security /
       performance gaps, missing UX and stories, and best-practices to
       bake in from day 1.
RELATED: context/PRD.md, context/UI_UX.md, context/USER_STORIES.md,
         context/DATA_TABLE.md, context/GLOSSARY.md, context/TECH_STACK.md
---

# PH-Navigator V2 — Pre-Implementation Docs Review

## A. Headline assessment

The doc set is **architecturally strong and unusually well-considered for a
pre-code project** — clear PRD, decisions-not-narrative TECH_STACK, a real
glossary, a deliberate split between durable `context/` and transient
`docs/plans/`. The bookshelf catalog model, the JSONB-with-shims schema
posture, and the access-check seam are all the right calls.

But the set has **four structural weak spots that will hurt during
implementation** if not addressed *before* phasing:

1. **The PRD has self-contradicted itself** in a few places where late
   2026-05-11 decisions were folded into the doc but the open-question
   list and earlier sections weren't updated. Engineers reading top-down
   will get a different answer than engineers reading §17.
2. **Concurrency / multi-actor scenarios are the single biggest gap**
   across PRD + UI_UX + USER_STORIES. The plumbing is specified (ETags,
   draft buffer, single-session); the *human-facing UX and the test
   surface* for what happens when MCP-and-browser collide, when a second
   tab opens the same version, when a session expires mid-edit, when a
   draft straddles a lock event — these are largely missing.
3. **Whole categories of user stories are missing** — Submit/Close,
   Diff/Compare, draft-restore-on-reopen, Catalog-manager, project-JSON
   download, errors/conflicts. Each is referenced as if it exists.
4. **The doc set has scaled past navigability.** **Partly resolved
   2026-05-11:** `USER_STORIES.md` is now a 56-line routing/phasing doc
   with canonical story bodies split under `context/user-stories/`. The
   resolved-Q archive cleanup remains.

Recommended next move: **2–4 hours of cleanup, then a vertical-slice
phasing plan** — not "start coding." Details in §L.

**Resolution update 2026-05-11:** The PRD contradiction item above
and all §B conflicts below have been resolved in the canonical docs.
The remaining A-level critical work before implementation is missing
story families, resolved-Q archive cleanup, and the security/ops
baseline items.

**Current gate triage 2026-05-11:** The review no longer blocks
vertical-slice planning. It still blocks *coding Phase 0/1/2* unless
the items below are resolved or deliberately deferred:

| Gate | Must decide / write down | Source |
|---|---|---|
| Before Phase 0 scaffold/auth | **Resolved 2026-05-11:** Phase 0 baseline = Origin/CORS allow-list, Argon2id password hashes, UUIDv4 sessions, DB-enforced single active session, 24h scoped idempotency keys, request-id middleware, structured errors/logging, health/version routes. Integrated in PRD §6.1, §9.5, §13, and the vertical-slice Phase 0 checklist. | D1-D6, D13-D14, I1-I8 |
| Before Phase 1 Status | **Resolved 2026-05-11:** add multi-value `projects.cert_programs` now (`phi`, `phius`, both, or empty). Status keeps one cert-program-agnostic default template in v1; PHI/Phius-specific templates defer to v1.1+. | C10, J5 |
| Before Phase 2 first editable table | **Resolved 2026-05-11:** denormalized save metadata is service-layer-owned; single-select lifecycle, async writes, paste coercion, no-temp-id row creation, computed-field hydration, and `US-Versions-Lifecycle` are decided. | C1-C2, C6-C9, G1-G5 |
| Before Phase 3 Windows | **Resolved 2026-05-11:** TS units strategy = V1-inspired, quantity-specific frontend helpers under `frontend/src/lib/units/`; catalog refresh uses field-level `catalog_origin.local_overrides`, per-field explicit choices, and no bulk auto-apply. | C5, C13 |
| Before Phase 6 MCP hardening | **Resolved 2026-05-12:** minimal MCP error UX baseline now; route/tool-specific error taxonomy during implementation. | G9 |

Everything else in this review is either already integrated, a later
phase hardening item, or an implementation-quality reminder rather than
a product decision.

---

## B. Conflicts that must be resolved before phasing

These are places where two parts of the canonical doc set say different
things. Each is a real risk: an engineer (or LLM) reading one will build
something the other forbids.

**Status 2026-05-11:** Resolved in `context/PRD.md`,
`context/UI_UX.md`, `context/USER_STORIES.md`, `context/GLOSSARY.md`,
and `context/DATA_TABLE.md`.

| # | Conflict | Resolution |
|---|---|---|
| **B1** | **PRD §16 (success criteria)** says non-logged-in viewers can "download HBJSON JSON," but **§17 #18** still lists "public access to HBJSON downloads" as an *open question*. **§6.5** independently decides it ("Public viewers may resolve signed download/view URLs for assets that are referenced by public project surfaces"). | Strike #18 from open questions; the rule is in §6.5. |
| **B2** | **PRD §17 #2** lists "lock semantics on submit/close" as open. **PRD §8.2** asserts "Submit/Close is `Save As with kind='submitted'`/`'closed'`, auto-locked." | Strike #2; reflect §8.2 as decided. |
| **B3** | **PRD §17 #1** lists "first version on project create" as open. **GLOSSARY** treats "Working" as a canonical kind label; **USER_STORIES US-1.3** assumes initial version is named "Working." | Strike #1; rule = always "Working", user can rename. |
| **B4** | **GLOSSARY**: "Builder = collective editing surfaces, *not a tab*." **UI_UX §1.1, §2.2, §3.2, §3.5** uses `/projects/{id}/builder` as a route, breadcrumb, and tab name. | Sweep-replace `/builder` with `/status` (default landing); breadcrumb shows active workspace tab. |
| **B5** | **GLOSSARY**: viewer-only-3D-tab is named **Model**. **UI_UX §3.5** calls it "3D Viewer"; many stories say "viewer." | Rename to **Model** + `/model` everywhere. Keep "viewer" as the user-facing common-noun for the 3D *surface*. |
| **B6** | **GLOSSARY**: **Viewer** = unauthenticated visitor. **USER_STORIES** uses "anonymous viewer," "public viewer," "view-link viewer," "non-logged-in viewer," and `view-link` interchangeably (US-WIN-1 cr.13 still says "On a public view link" — but per PRD §9.9 view-links *do not exist*). | Sweep-replace to "Viewer." Remove all `view-link` language. |
| **B7** | **PRD §6.2 sketch** shows window-element with `frame: {…}` (singular). **USER_STORIES Q-WIN-2 / US-WIN-1 cr.8** uses `frames: { top, right, bottom, left }`. **GLOSSARY** says "inlined Frame and Glazing data" (singular). | Pick one (per-side is what V1 does and what cert cares about); update all three docs. |
| **B8** | **PRD §10.5** specifies "Read-safe-mode fallback" if a shim raises. **PRD §16** lists "Opening a project with older schema_version succeeds via shim chain; if any shim raises, read-safe-mode" as a success criterion. **USER_STORIES has no story** for what the user actually sees in this state. | Add `US-Errors-SchemaFallback` covering the banner, the JSON download CTA, and the lock state. |
| **B9** | **PRD §17 #14** lists "R3F migration of V1 viewer code" as open. **PRD §11.4.4–.6** is decided (port loaders 1:1, then refactor). | Strike #14 or rephrase to "implementation tactic — not a gating decision." |
| **B10** | **DATA_TABLE.md §13** copies POC sandbox into the doc as canonical examples; **CLAUDE.md** says "don't import from research/." | Add a one-line warning at §13: "examples are reference-only; rewrite for V2." |

There are ~5 more medium conflicts noted in the supporting agent reports
(Q-WIN-7 collision, US-Settings cascading-rename, US-WIN-3 cr.9 vs
Q-WIN-3.3 contradiction, glossary `current_version_id` chicken-and-egg).
Worth a single sweep pass.

---

## C. Critical under-specified areas — engineers can't build without these

Not bugs in the design; gaps in the contract.

### C1. The `last_saved_at` and `body_size_bytes` denormalizations

PRD §6.1 declares `projects.last_saved_at` and
`project_versions.body_size_bytes` as denormalized, "updated on every
Save / Save As." **Where** the update happens isn't specified — service
layer? trigger? The denorm/source-of-truth boundary is the kind of thing
that drifts within a year. Spec it once: trigger or service, not both.

**Resolved 2026-05-11:** service-layer ownership, no DB triggers.
The version-save service is the only code path that inserts/overwrites
`project_versions.body`. Save / Save As compute
`body_size_bytes`, set `project_versions.updated_at`, set
`projects.last_saved_at`, clear the draft, and write the action-log
event in one transaction. Draft patch does not update these fields.

### C2. The `single_select_options` lifecycle

PRD §6.2 introduces `single_select_options` keyed by
`<table_path>.<column_key>`. Behaviors not specified: option rename
(rows hold `option_id`, so non-destructive — good), option **delete**
(rows pointing at deleted option_id render as what?), option **merge**,
conflict on duplicate label. None of these are exotic — they need
answers.

**Resolved 2026-05-11:** row cells store `option_id`; rename/reorder
are non-destructive; duplicate labels are rejected after trim +
case-insensitive comparison; delete of referenced nullable options
requires confirmation and clears cells to `null`; delete of referenced
required options is blocked until rows are reassigned or merged; merge
rewrites source option references to the target option in one semantic
write op; missing option ids render a warning and block Save until
cleared or reassigned.

### C3. The MCP `query_table` filter expression

PRD §10.3 lists
`query_table(project_id, version_id, table_name, filter_expr)` —
`filter_expr` is a string. Is it SQL? JSONPath? A custom DSL? **Big
surface, big security concern** (eval'd input from an LLM is an
injection vector). Decide before the MCP route ships.

**Resolved 2026-05-12:** `query_table` takes a constrained typed
Pydantic query object, not SQL-like text, JSONPath, Python, or any other
expression string. The v1 query object supports optional substring
search, `and` / `or` groups, simple field comparisons, allow-listed
operators (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `contains`,
`is_empty`, `is_not_empty`), allow-listed sort fields, offset, and a
server-capped limit. Field names and operators are validated against the
table schema / field registry before execution. Results return compact
row summaries plus stable row targets for follow-up calls.

Research note: Ladybug Tools MCP uses typed domain search tools with
explicit parameters, simple substring `query`, compact reusable targets,
and strict input validation. It does not expose arbitrary SQL/JSONPath
query strings for model-object search. Use that as the precedent, while
keeping PHN's generic table search table-schema-driven.

### C4. The MCP `replace_table` concurrency contract

PRD §10.3 lists `replace_table(...)` and §9.5 lists
`PUT /draft/tables/{name}`. Neither specs how the LLM client supplies
`If-Match`. LLMs will not naturally reach for ETags. Either expose a
`version_etag` parameter on the tool (recommended) or document a "blind
replace + last-writer-wins" semantic explicitly.

**Resolved 2026-05-11:** `replace_table` takes
`draft_etag | base_version_etag` and uses whole-draft optimistic
concurrency. Stale table replacement returns 409 even when the winning
write touched a different table.

### C5. The TS units library

PRD §17 Q-UNITS-2 ("port `PH_units` / use `convert-units` / write
per-quantity helpers") is **load-bearing for every Builder story**.
USER_STORIES has parser specs (US-WIN-10 cr.4) that assume *some*
library. Resolving late risks rewriting parser code. Decide before
phasing.

**Resolved 2026-05-11:** write focused, quantity-specific TypeScript
helpers under `frontend/src/lib/units/`; do not port all of Python
`PH_units` and do not add a generic units package for MVP. Use V1's
frontend units implementation as precedent/template:
`../ph-navigator/frontend/src/formatters/Unit.Converter.ts`,
`../ph-navigator/frontend/src/formatters/Unit.ConversionFactors.ts`,
`../ph-navigator/frontend/src/features/project_view/_hooks/useUnitConversion.tsx`,
`../ph-navigator/frontend/src/features/project_view/_contexts/UnitSystemContext.tsx`,
`../ph-navigator/frontend/src/features/project_view/_components/UnitSystemToggle.tsx`,
and especially the Window Builder dimension parser/test files under
`../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/`.
Reuse the V1 shape and tests, but verify thermal conversion factors
against fixtures before landing in V2.

### C6. `<DataTable>` `onWrite` and `onViewChange` async semantics

DATA_TABLE §4.1 says `onWrite` returns `void | Promise<void>` but
doesn't state whether the table waits, blocks input, or queues.
`onViewChange` will fire dozens of times per resize-drag — no debounce
contract. Both are interaction-blocking gaps.

**Resolved 2026-05-11:** DataTable uses optimistic local edits with a
parent-owned FIFO persistence queue per open table/draft. The UI remains
editable while writes are pending; Save / Save As first flush the queue.
Conflict/auth/locked/validation failures stop the queue, roll back to
the last server-acknowledged snapshot, clear undo, and delegate to the
parent error UI. `onViewChange` is not a document write: resize commits
on drag end, filter text debounces around 250 ms, and sort/group/hide
emit immediately.

### C7. `<DataTable>` clipboard coercion error channel

DATA_TABLE §5.1 `coerceFromClipboard` returns `T | null`. Bad data
silently becomes null with no error. Paste of a 100-row CSV with two
malformed cells will make those cells silently null with no indication.
Add a structured `{ value, error? }` return.

**Resolved 2026-05-11:** `coerceFromClipboard` returns a structured
`CoerceResult<T>`. Blank values become `null` only for nullable fields;
required blanks and invalid values return an error. Multi-cell paste
preflights the full range before any draft write; if any cell fails, no
partial paste is committed. The paste review dialog shows row, column,
raw value, and error for the first 25 failures plus an overflow count.

### C8. `<DataTable>` computed-field hydration

DATA_TABLE §5.2 introduces `computed` field type ("computed in backend")
but never says how the renderer gets the value: included in row payload?
recomputed on dependency edit? cached? Affects R-value (US-ENV-7 cr.11),
ACH50 (US-ENV-14), and any future totals.

**Resolved 2026-05-11:** computed table values are backend-owned read
overlays, not editable/stored row fields by default. Table/domain
endpoints may return row data plus a `ComputedOverlay` keyed by row id
and field key. `computed` field definitions declare `compute_key`,
dependencies, and display/unit formatting; parent code marks affected
cells stale/loading and refetches after successful dependency writes.
Frontend renders values and stale/loading/error states but never
reimplements domain calculations.

### C9. `<DataTable>` `tmp-` ID reconciliation

When paste-add creates rows with `tmp-{n}` ids and the server assigns
real ULIDs, who reconciles — table or parent? What happens to
active-cell focus / selection / undo on a `tmp-` id during
reconciliation? Affects every "paste new rows" flow.

**Resolved 2026-05-11:** no `tmp-` ids for browser-created document
rows in v1. The frontend generates final ULID-style ids using the table
prefix before optimistic display; the backend validates prefix, shape,
and table-local uniqueness, then preserves the ids. Selection, focus,
undo, pending writes, and JSON-Patch paths therefore remain stable with
no id-remapping phase.

### C10. The Status-tab template story

USER_STORIES US-Status assumes one hardcoded "BLDGTYP default template."
But Phius vs PHI projects have different cert milestones, and a project
may pursue both certifications. Certification program metadata isn't on
the projects table.

**Resolved 2026-05-11:** add `projects.cert_programs TEXT[]` with
allowed values `phi` and `phius`; both may be selected because one
building can pursue both certifications. Empty means no program selected
yet or design-analysis-only. MVP still ships one generic
cert-program-agnostic BLDGTYP Status template; program-specific
templates are deferred until there is enough workflow pressure to
justify them.

### C11. HBJSON "viewer-only" vs "extracted volume" boundary

GLOSSARY: "HBJSON never imports into Builder tables." US-ENV-14
(Airtightness) computes ACH50 *from*
`project_hbjson_files.extracted_volume_m3`. That's a
derived-but-not-imported category that the glossary doesn't acknowledge.
Either tighten the glossary or rename the column.

### C12. Single-Select option delete with referencing rows

If a user deletes a `floor_level` option that 12 rooms reference, what
happens? Rows hold `option_id`, so the renderer needs a fallback
("(deleted: 'Basement')"?). Unspecified.

### C13. Refresh-from-catalog when user has *also* edited

US-ENV-11 / US-WIN-11 hand-wave: "rows tagged with 'You edited this'."
If the catalog also changed the same field, three-way merge is implied
but not specified.

**Resolved 2026-05-11:** track user edits at field level with
`catalog_origin.local_overrides: string[]`, not a single diverged
boolean. Inline edits add field keys. Refresh dialogs tag those fields
"You edited this" and default them to **Keep mine**; other changed
fields default to **Take catalog**. Saving a refresh requires explicit
choice for every changed field, updates `catalog_version_id` to the
current catalog version, sets `synced_at`, and recomputes
`local_overrides` as fields still intentionally different from the
current catalog value. Review all opens the drift/customization report
with per-entry actions; no bulk auto-apply in v1.

---

## D. Security & ops gaps

These aren't in the docs at all and are easy to get wrong post-launch.

| # | Gap | Recommendation |
|---|---|---|
| **D1** | **No CSRF protection mentioned.** Cookie auth + state-changing JSON endpoints = textbook CSRF surface. SameSite=Lax helps but is not sufficient for non-GET cross-site (especially with Permissions-Policy on subdomains). | Add a double-submit or origin-check policy. Decide before the auth route lands. |
| **D2** | **No CORS spec.** Frontend at `nav.bldgtyp.com`, backend at `api.bldgtyp.com` (or similar) requires explicit allow-list. | Decide subdomain layout, write CORS config into the auth/scaffold task. |
| **D3** | **No rate limiting** anywhere — including on the public read routes (which now have no auth). Anyone with a project URL can scrape. | At minimum, per-IP token bucket on read routes; harder per-token limits on MCP. |
| **D4** | **No password-hashing algorithm specified.** `users.password_hash TEXT` is not a contract. | Pin Argon2id with explicit memory/parallelism parameters, or bcrypt cost ≥12. Doc it in §13. |
| **D5** | **Session ID = `sessions.id UUID`.** Must be UUIDv4 (cryptographically random), not v1/v3/v5. Worth one line in §6.1. | — |
| **D6** | **No DB-level guard for "single active session per user."** Enforced only in app code; a bug = silent multi-session. | Partial unique index `WHERE invalidated_at IS NULL` on `sessions(user_id)`. |
| **D7** | **Asset upload size caps unspecified for non-HBJSON.** PDFs (datasheets), photos — no max declared. | Per-`asset_kind` cap table in §6.5 (e.g., datasheet 50MB, photo 25MB, hbjson 50MB). Enforce in `upload-intent`. |
| **D8** | **Content-hash dedup is `INDEX`, not `UNIQUE`.** Two simultaneous uploads of the same file race. | `UNIQUE (project_id, asset_kind, content_hash_sha256) WHERE deleted_at IS NULL` — and have `complete-upload` recompute the hash from R2 (don't trust the client). |
| **D9** | **No HTML/clipboard sanitization spec.** DATA_TABLE writes `text/html` on copy; on paste, parse policy unspecified. | Spec: parse `text/plain` TSV only; ignore `text/html` on paste. Explicit ban on `dangerouslySetInnerHTML` in any cell renderer. |
| **D10** | **No virus scan / MIME-sniff for uploads.** PDFs from contractors are an attack surface. | At minimum, server-side MIME sniff + extension check; ClamAV or VirusTotal optional but worth deciding. |
| **D11** | **EXIF stripping not mentioned for site photos.** Phone photos carry GPS. Public viewers can download photos via signed URLs (per §6.5). Job-site GPS in a contractor URL is a privacy issue. | Strip EXIF on upload. |
| **D12** | **No backup / DR / RPO-RTO targets.** Render's managed Postgres has automated backups; R2 has durability. But "I deleted my project 100 days ago and want it back" needs a soft-delete TTL + tested restore path. | Spec a soft-delete TTL (e.g., 1 year), document Render PITR window, write a restore drill into the operations checklist. |
| **D13** | **No structured app logging or error tracking.** Render captures stdout, but Sentry / OpenTelemetry / structured logs are unmentioned. | Decide before §16 success criteria are testable — you need traceability for the MCP write surface. |
| **D14** | **Idempotency-Key spec is one line.** PRD §9.5 says writes "accept" the header but doesn't specify TTL, response-cache shape, or scope (per-user? per-route?). | Pin: 24h TTL, scope = `(user_id, route, key)`, return cached response on replay. |
| **D15** | **Secrets posture for production unstated.** `.env` for dev, but production secrets on Render dashboard. Worth one line in `ENVIRONMENT.md`. | — |

**Resolution update 2026-05-11 for Phase 0 gate:** D1-D6, D13, D14,
and I1-I8 are accepted as the Phase 0 security/ops baseline:
Origin/CORS allow-list for browser writes, Argon2id password hashes
(bcrypt cost >= 12 fallback only), UUIDv4 session ids, DB-enforced
single-active-session via partial unique index, 24h scoped idempotency
keys, request-id middleware, structured errors/logging, and
`/api/v1/health` + `/api/v1/version`.

---

## E. Performance gotchas

| # | Concern |
|---|---|
| **E1** | **Postgres rewrites the whole JSONB column on every UPDATE.** A 5MB project body × ~5 patches/sec during typing × hours of editing = significant write amplification. Consider per-table draft slices (PRD §15 mentions this as v1.1) or batched debounced writes (already specified at 500ms — keep that bound tight). |
| **E2** | **Bundle size budget is unspecified.** R3F + drei + postprocessing + TanStack Table + react-virtual + shadcn + Tailwind + pdf.js = nontrivial. Set a target (e.g., main bundle ≤ 350KB gzipped, viewer code-split). |
| **E3** | **Large-paste copy (DATA_TABLE #23):** ⌘A then ⌘C on 10k×20 cells will block the main thread serializing TSV+HTML. Soft cap with a "copy is large, continue?" gate. |
| **E4** | **Large-paste write (DATA_TABLE #17):** Pasting 5k rows into a virtualized table — writes operate on row data not DOM (good), but the WriteOp arrays balloon. Cap per-op size or chunk the patch batch. |
| **E5** | **`useMemo` derivation in `<DataTable>` (#30):** Depends on object refs in ViewState. If parent doesn't memoize, every render invalidates. Document parent's responsibility OR shallow-compare internally. |
| **E6** | **Virtualized ARIA correctness (#34):** `role="grid"` with virtualized rows needs `aria-rowindex` truthful and `aria-rowcount` reflecting full data, not visible. |
| **E7** | **HBJSON parse in browser** (PRD §17 #19): 5–20 MB JSON parse + geometry build will block the main thread for seconds. Worker-thread parsing or server pre-extracted geometry are both fine answers — but pick a default loading-state UX. |
| **E8** | **Diff computation cost.** PRD §8.4 says "Diff is computed in the backend from the two JSONB bodies." For a 5MB body this is fine; for the per-table diff on a 10k-row table, less obviously so. Set a budget. |

---

## F. Concurrency / multi-actor edges — the biggest cross-doc blind spot

The plumbing is specified (PRD §8.5, §13). The **human-facing surface**
is largely unwritten.

| # | Scenario | Doc state |
|---|---|---|
| **F1** | **Second browser tab opens the same active version.** PRD §8.5 previously said "advisory + read-only unless takeover." | **Resolved 2026-05-11:** same-editor browser tabs are allowed and coordinated through draft ETags + browser-tab patch/etag broadcasts. Disjoint UI scopes may both edit. Same-scope conflicts freeze the stale scope and require review/reload. Captured in PRD §8.5 + `US-Concurrency`. |
| **F2** | **MCP and browser editing the same draft (same user).** PRD §8.3 says "share the same draft." | **Resolved 2026-05-11:** MCP mutating tools take a short edit lease; browser shows an MCP/Claude editing indicator and freezes write controls while active. After MCP writes, browser offers Review changes / Reload draft / Keep local state. Captured in `US-Concurrency`. |
| **F3** | **MCP token revoked while LLM is mid-write.** PRD §13 says "Revocation is immediate." | **Resolved 2026-05-11:** revocation blocks the next MCP request; an already-authenticated in-flight request may complete atomically, but every follow-up commit step re-checks token state and fails with structured auth if revoked. Captured in PRD §8.5 + `US-Concurrency`. |
| **F4** | **Session expires mid-edit on idle tab.** PRD §13 specs the active-tab path well. | Idle-tab path silent. Anonymous-viewer-tab path silent. |
| **F5** | **Editor B locks Version while Editor A has a draft open on V.** | **Resolved 2026-05-11:** lock is authoritative immediately. Open drafts are preserved, but patch/Save return `409 version_locked`; user can Save As, discard, or wait for unlock. |
| **F6** | **Version becomes locked mid-edit due to MCP/another tab.** UI_UX §2.7.1 spec'd a static banner; live downgrade not addressed. | **Resolved 2026-05-11:** editable tabs downgrade on next poll, broadcast, or rejected write; inputs freeze and the normal locked-version banner appears. |
| **F7** | **Single-active-session sign-in cycle.** Displaced device sees 401, signs in again, displaces the new session. Cycle. Sign-in modal should warn. | **Resolved 2026-05-11:** displaced-session modal warns that signing in here signs out the other PHN session; Cancel keeps the tab read-only. |
| **F8** | **Save fails 409 mid-version-switch.** US-3.1 dirty-draft prompt → user picks Save → succeeds → switch fetch fails. User now in limbo. Spec a transactional swap. | **Resolved 2026-05-11:** frontend does not switch visible version until target fetch succeeds. If Save succeeds but target fetch fails, user remains on the saved source version, clean, with retry toast. |
| **F9** | **`replace_table` race vs unrelated table edits.** Two MCP tools, two tables, one base ETag. Second loses. ETag bump strategy unspecified. | **Resolved 2026-05-11:** second loses. `replace_table` uses whole-draft ETag; unrelated accepted writes still bump `draft_etag`, stale table replace returns 409 and must refetch/retry. |

A single **US-Concurrency** cross-cutting story collecting F1–F9 (with
explicit acceptance tests) would close the largest single gap in the
user-story corpus.

---

## G. Coverage gaps in user stories

PRD-promised behaviors with no story:

- **G1.** ~~Submit / Close lifecycle (PRD §8.2).~~
  **Resolved 2026-05-11:** covered by `US-Versions-Lifecycle`.
- **G2.** ~~Diff / Compare-Versions UI (PRD §8.4 + §16).~~
  **Resolved 2026-05-11:** covered by `US-Versions-Lifecycle`.
- **G3.** ~~Draft restore on reopen (PRD §8.3).~~
  **Resolved 2026-05-11:** covered by `US-Versions-Lifecycle`.
- **G4.** ~~Discard changes gesture (PRD §8.2).~~
  **Resolved 2026-05-11:** covered by `US-Versions-Lifecycle`.
- **G5.** ~~Project-JSON download (PRD §9.7 + §16).~~
  **Resolved 2026-05-11:** covered by `US-Versions-Lifecycle`.
- **G6.** Catalog Manager CRUD UX (PRD §7.3).
- **G7.** Schema-version migration banner / read-safe-mode (PRD §10.5).
- **G8.** Multi-tab / second-tab UX (see F1).
- **G9.** ~~MCP-actor stories (token issue/revoke UX,
  write-attribution surface, error UX).~~ **Resolved 2026-05-12:**
  token issue/revoke, write attribution, and MCP query behavior are
  covered in `NEW-LLM-API-1` / `US-Concurrency`. MCP error UX is
  intentionally minimal in planning: REST/MCP share a structured
  envelope with `code`, `message`, `request_id`, and coarse
  `recoverability`; exhaustive code names, `details`, and `next_action`
  are defined while implementing each route/tool. Browser failure
  behavior: release MCP edit leases, preserve local edits, avoid
  silently applying failed/partial MCP state, and surface a concise
  request-id-bearing banner/toast when the open draft/project is
  affected.
- **G10.** Errors / failure modes consolidated story (`US-Errors`).

---

## H. Schema / migration discipline gaps

The §10.5 migration discipline is genuinely strong — golden fixtures,
forward-only shims, never-remove-old. Two refinements:

- **H1.** **Production-corpus drill is staging-only.** "CI runs new shim
  against every live project body in a staging snapshot" — but staging
  ≠ production. Worth a periodic prod-snapshot import test or at least
  an explicit "this drill catches X but not Y" caveat.
- **H2.** **Pydantic re-validation after shim succeeds is a separate
  failure path** from "shim raises." Spec needs to handle both: shim
  succeeds but `ProjectDocumentVN.model_validate(upgraded)` raises.
- **H3.** **Alembic-side migrations have no story.** PRD §12.1 says
  "manual." But a deploy with a relational migration on tables like
  `project_status_items` could cause editor-side weirdness (rows
  missing fields). What does the editor see during a deploy? Worth one
  operations note.
- **H4.** **The `manufacturer_filters` table** is referenced in PRD
  §6.2 (`tables.manufacturer_filters`) but never defined. Either drop
  or spec.
- **H5.** **The `snapshot` `kind`** is in the enum but never explained
  in PRD §8 (only in glossary). What creates a snapshot? Auto? User?
  Scheduler?

---

## I. Best practices to bake in from day 1

These are cheap to do now, expensive later:

1. **`/api/v1/health` and `/api/v1/version` routes.** Render needs them;
   you'll want them anyway.
2. **Structured logging from the first commit.** JSON logs with
   `request_id`, `user_id`, `project_id`, `version_id` baked into the
   FastAPI middleware. Free observability later.
3. **`request_id` header round-trip.** Frontend sends, backend logs,
   error responses include it. One-step support debugging.
4. **`X-PHN-Schema-Version` response header on `/document` reads.**
   Cheap signal for the frontend to compare to its expected version
   without re-parsing.
5. **Database connection pool sized at startup** (psycopg_pool min/max).
   Easy to tune, hard to add later.
6. **OpenAPI client codegen wired into `make sync`** (PRD §17 OQ —
   leaning yes — just decide). `openapi-typescript` for types only is
   the lightest option.
7. **A single shared structured-error module** (PRD §10.2 references
   "machine-readable codes"). Both REST and MCP wrap it. Start with the
   minimal envelope required by PRD §10.3; grow route/tool-specific codes
   deliberately during implementation, not as raw ad-hoc exceptions.
8. **Idempotency-Key middleware from day 1.** Even if no client uses it
   yet, the contract is in place.
9. **Pydantic `extra='forbid'` on document/table models** so unknown
   fields are rejected at the boundary, not silently retained. Critical
   for the LLM-write surface.
10. **A single `repository/conn.py` transaction context manager** with
    explicit isolation level. JSONB updates + draft writes need
    read-committed at minimum; spec it once.
11. **Fixture seeds for local dev** (a seed user, a seed project, a
    seed catalog row) so `make smoke` is meaningful from commit 1.
12. **A `make typecheck` recipe** running `mypy` / `pyright` on backend
    and `tsc --noEmit` on frontend. CI gate.
13. **A `make schema-check` recipe** that diffs Pydantic-generated JSON
    Schemas against the committed `context/schemas/*` files. Failure =
    drift. (Lightweight version of PRD §10.4 CI requirement.)
14. **One `WriteOp` consumer pattern picked early** for `<DataTable>`.
    Per DATA_TABLE §3, the WriteOp pipeline is the architectural
    pillar; the persistence transport is a swap. Pick the pattern once
    and apply uniformly across Catalog, Builder-Windows,
    Builder-Envelope, Equipment.

---

## J. What you're not thinking of — strategic blind spots

| # | Blind spot |
|---|---|
| **J1** | **Mobile read-only is implicitly required.** §0 of UI_UX says "phone is non-goal," but contractors and PHCs *will* open public-share URLs from job sites. Site Photos and Airtightness are explicitly framed for trades. A minimal mobile read-only pass on public surfaces is closer to MVP than the docs admit. |
| **J2** | **Email infra is not mentioned** anywhere. Stale-draft warnings (PRD §17 #12), password resets (admin path), invite flows — all imply email. Even one transactional email needs SES/Postmark/Resend wired in. Decide now or accept "no email" as a v1 hard rule. |
| **J3** | **Print / PDF export.** Cert deliverables sometimes need printable summaries. PRD §12 dropped V1's html2pdf and says "replaced by server-side PDF if/when needed." Worth pinning one tool early (WeasyPrint? Playwright headless?) so it's a 2-day project not a 2-week one when it lands. |
| **J4** | **No project-level activity stream** in v1 (PRD §15 acknowledges "trivia like 'did John make this change?' becomes a SQL task"). With MCP writing to drafts, this is a UX gap, not just an admin one. A simple per-project last-N-events drawer is cheap. |
| **J5** | **Per-project cert program is not on the model.** `phius_number` on `projects` implies Phius — but PHI projects have different milestones, dual PHI/Phius certification is possible, and "no certification" is also valid. Without a multi-value `cert_programs` column, the Status template (G7), the milestone tracker, and any future cert-specific validation will be conditional on `phius_number IS NOT NULL`, which is fragile. **Resolved 2026-05-11:** add `projects.cert_programs` with allowed values `phi` and `phius`; keep the v1 Status template generic. |
| **J6** | **No explicit data-retention/GDPR posture.** Even for a 2-person internal-ish tool, contractors and clients are real-world identifiable individuals (in photos, in audit logs). One paragraph on "we keep X for Y" makes this defensible. |
| **J7** | **The `apply-default-template` action is the only onboarding affordance.** New users will not discover Pick / drift / refresh-from-catalog without help. A `?` per-tab popover is one day of work and prevents support overhead for the rest of the project's life. |
| **J8** | **Color-only signals (UI_UX #30)** — save status dot, drift `↻`, filter/sort/group tints — fail for color-blind users *and* in dark/light mode. Pair every color signal with an icon or label. |
| **J9** | **Keyboard shortcuts conflict with browser** (UI_UX #32) — `⌘D` (bookmark), `⌘R` (reload, collides with Fill-Right). Either scope to active-cell-edit-mode only, or pick non-conflicting bindings. |
| **J10** | **No CDN / static-asset story.** Vite frontend deployed to Render static hosting. R2 already in stack — consider serving the frontend static bundle from R2 + a CDN front. Cheap and removes Render from the latency path. |
| **J11** | **The disconnect between Builder data and HBJSON** (PRD §11.4.6) is acknowledged-not-loved. Editors uploading the wrong HBJSON for the current project state will silently look fine. A *very weak* validation banner ("HBJSON last linked to project version V2; current is V3") would catch the worst cases without committing to bridging. |
| **J12** | **Catalog write authorization is single-tier** ("any editor can edit the global library"). For a 2-person firm this is fine. Worth flagging that growing the firm = growing this surface. |

---

## K. Doc-set hygiene

The doc set has scaled past one-person navigability.

| # | Observation |
|---|---|
| **K1** | ~~**`USER_STORIES.md` is 8168 lines with no TOC.** Story IDs (US-N, US-WIN-N, …) imply structure; no anchor index at the top means navigation is grep-only.~~ **Resolved 2026-05-11:** `USER_STORIES.md` is now a routing/phasing document; canonical story bodies live in `context/user-stories/*.md`. |
| **K2** | **The Open Questions index in `USER_STORIES` (~140 rows, mostly resolved/struck-through)** is doing two jobs poorly: history archive *and* current open-issues tracker. Split: archive resolved Q-* to `docs/decisions/` (or `REMOVED.md`), keep the index ~10 rows of *actually open* items. |
| **K3** | **Repeated cross-cutting criteria** ("Locked-version + anonymous-viewer rendering," "All mutations flow through the draft buffer") appear in ~20 stories. Promote to a single shared "inherited acceptance criteria" section; cite by reference. |
| **K4** | **Two `Q-WIN-7` exist** (one cross-tier paste, one frame-label flip). Confusing. |
| **K5** | **`US-ENV-15` has its `Resolved questions` section duplicated** (~lines 5315 and 5357). Editorial cruft. |
| **K6** | **PRD §17 has resolved + open questions interleaved** with `~~strikethrough~~`. After 6+ resolutions, the section reads as more-history-than-status. Same fix as K2. |
| **K7** | **`AGENTS.md` is a near-perfect mirror of `CLAUDE.md`** with manual sync. Drift risk. Either symlink, generate from one, or be explicit that one is canonical and the other is generated. |
| **K8** | **`research/` is referenced load-bearingly** (V1 parity stories) but `CLAUDE.md` says "don't import from research/." Worth one line clarifying: "research/ is reading-only documentation; rewrite for V2." |
| **K9** | **Generated docs absent.** `context/schemas/`, `api.md`, `mcp.md`, `error-codes.md`, `llm-cookbook.md` all listed in PRD §10.4 as "added when implementation lands." Make sure the *first* feature commits add the first scaffolds — otherwise these never land. |
| **K10** | ~~**`docs/plans/` is empty after the recent cleanup.** Good — fresh start. Establish the pattern with the first phasing plan.~~ **Resolved 2026-05-11:** `docs/plans/2026-05-11/vertical-slice-phasing.md` created. |

---

## L. Recommended next operations (before phasing)

In rough priority order — each is cheap (hours, not days).

1. ~~**One-pass conflict cleanup** of the 10 items in §B above.~~
   **Done 2026-05-11.** This unlocks any subsequent reading by an LLM
   or new collaborator.
2. **Move resolved `Q-*` rows out of PRD §17 and `USER_STORIES` Open
   Questions index** into a `docs/decisions/2026-05-resolved-questions.md`.
   Keep only currently open items in the index.
3. ~~**Add a `USER_STORIES` TOC** at the top, plus a one-line cluster
   summary (US-WIN-* covers windows, US-ENV-* covers envelope, US-EQ-*
   covers equipment, US-VIEW-* covers Model tab).~~ **Done
   2026-05-11:** `USER_STORIES.md` is now a routing/phasing document
   pointing to split story files under `context/user-stories/`.
4. **Write 4 missing story families** as stubs with anchor refs to PRD
   sections, even if the bodies are short:
   - **`US-Concurrency`** (collects F1–F9 above).
   - **`US-Errors`** (consolidates G10).
   - ~~**`US-MCP-*`** (G9; token issue/revoke/UX, write attribution,
     error surfacing).~~ **Resolved 2026-05-12:** covered by
     `NEW-LLM-API-1` and `US-Concurrency`; detailed MCP error taxonomy
     is implementation work behind the shared minimal envelope.
   - **`US-Versions-Diff`** + **`US-Versions-Submit-Close`** +
     **`US-Versions-Discard`** + **`US-Versions-Restore-Draft`**
     (G1–G4) — these can be a single `US-Versions-Lifecycle` story.
5. **Add a §13.5 "Security baseline" to PRD** covering D1–D11 and D14
   in a single decisions table. Each item gets a one-line answer.
6. **Add a §6.6 "Operational baseline"** covering D12 (backups), D13
   (logging), D15 (secrets) plus E2 (bundle budget) and E7 (HBJSON
   parse target).
7. ~~**Resolve Q-UNITS-2 (TS units library).**~~
   **Done 2026-05-11:** V2 uses quantity-specific frontend helpers,
   with V1 unit-converter/context and Window Builder dimension parser
   files as research/templates.
8. **Decide the access-check seam test.** PRD §4.1 commits to it but
   doesn't say how it's tested. Add one acceptance test: "no project
   route can be served without going through `require_project_access`"
   — a static-analysis or grep-in-CI check.
9. ~~**Then write the vertical-slice phasing plan** (PRD §19.3 calls for
   this). The slice should hit: auth → dashboard → project create →
   `ProjectDocumentV1` → one editable table → draft + Save + Save As +
   lock → public read mode → JSON schema/download → one Catalog pick.~~
   **Done 2026-05-11:** see
   `docs/plans/2026-05-11/vertical-slice-phasing.md`.
   With the cleanups above, this plan can ride the docs as-is.

---

## M. What's strong and should not be touched

So the review isn't all critique:

- **The Save/Save As/Draft/Lock model (PRD §8) is genuinely
  well-thought.** The state machine + acceptance-test list + ETag
  concurrency model are tight. Don't second-guess.
- **The bookshelf catalog with Pick-as-copy + `catalog_origin`
  provenance (PRD §7.1)** is the correct call and is precisely
  specified.
- **The forward-compatible access-check seam (PRD §4.1)** is the right
  kind of architectural commitment — cheap now, saves real pain later.
- **The schema migration discipline (PRD §10.5)** is unusually rigorous
  for an MVP and worth preserving exactly as written (with refinements
  H1–H3).
- **The `<DataTable>` "WriteOp + FieldDef-registry + ViewState" trinity
  (DATA_TABLE §3 lessons)** is a genuinely strong abstraction set. The
  architectural pillars survive — the gaps are around edges and
  contracts, not concept.
- **The TECH_STACK persistence decision (Raw SQL + Pydantic, no ORM)**
  is correctly motivated for this product. Don't relitigate.
