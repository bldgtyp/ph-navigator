---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred
AUTHOR: Claude with Ed May
SCOPE: State ledger for aperture catalog-drift UX parity.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Aperture catalog-drift UX parity

## Current state

`Deferred`. Scoped and audited on 2026-08-03 while shipping the equivalent
work for Envelope materials; no aperture code has been touched.

The audit in `PRD.md` was read off the current implementation
(`ApertureSpecReportPanel.tsx`, `BuilderDriftBanner.tsx`, `RefreshDialog.tsx`)
and is accurate as of commit `32a96839` plus the materials drift rework.

## Next step

Answer PRD Q1 (is there a `customized` analogue for aperture entries?) and Q3
(sequence against the shared segmented control). Both are decisions, not
investigations — an hour of reading `features/aperture_drift/` and the
`in_local_overrides` semantics settles them.

## Blockers

None. This is deferred by choice, not blocked.

## Verification recipe

The materials work was verified against a real drifted fixture; do the same
here. Aperture drift needs a project aperture whose catalog frame/glazing row
moved after it was copied in:

1. `make agent-browser-ready` — starts :5173/:8000 and seeds `AGENT-BROWSER`
   (`codex@example.com`).
2. Add an aperture type with a catalog-origin frame and glazing via the
   `phn-local` MCP `apply_aperture_command` (pass the current `draft_etag` as
   `if_match`).
3. Create drift by editing the **catalog** row directly, then restoring it —
   drift is a field-value comparison, so the sequence matters: pick the
   material into the project *before* the catalog value differs, or edit the
   catalog after the pick.
   ```
   uv run python -c "import psycopg; ..."   # backend/, dsn postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2
   ```
4. Screenshot with `node scripts/agent-browser.mjs <route> --click 'role=button[name="Restore draft"]' --out …`
   (the fixture has a dirty draft, so the recovery modal must be dismissed first).
5. **Restore every catalog row you edited and delete the scratch aperture.**
   The local catalog is global; leaving it edited is the "dev DB stale vs seed"
   trap.

## Log

- **2026-08-03** — Packet created. Audit performed while shipping the Envelope
  materials equivalent; six concrete defects recorded in `PRD.md` (A-1…A-6),
  three open questions.
