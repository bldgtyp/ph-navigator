---
DATE: 2026-08-03
TIME: 11:03 EDT
STATUS: Complete
AUTHOR: Claude with Ed May
SCOPE: Give AttachmentCell an explicit unavailable state instead of rendering an
  unresolvable asset as a plausible-looking empty file.
RELATED:
  - ../PRD.md
  - ./phase-04-download-error-ux.md
  - ../../../../../../context/DESIGN_SYSTEM.md
---

# Phase 05 — Explicit unavailable state

## Goal

An attachment the client cannot resolve looks unavailable, not empty. A viewer
can tell the difference between "still loading", "this file is withheld or
gone", and "a real file with no thumbnail".

## Depends on

Nothing. Independent of the backend bundle and of Phase 04.

## The defect

`AttachmentCell` treats "no `AssetUrls` for this id" as an ordinary
un-thumbnailed file:

- **Tile** (`AttachmentCell.tsx:173-182`) — falls back to
  `fileGlyph(asset?.content_type)`, and `fileGlyph(undefined)` returns the
  literal string `"FILE"` (line 322-326). Indistinguishable from a genuine
  unknown-type attachment.
- **Modal** (`AttachmentCell.tsx:265-299`) — header falls back to the raw asset
  id; no `preview_url` so both the image and PDF branches are skipped; the file
  panel renders `FILE` over `asset?.content_type ?? "File"`. "Open in new tab" is
  conditional on `preview_url`, so it silently vanishes.

That is exactly screenshots 1 and 3 in Ed's report. Even after Phases 01–02 make
these particular assets resolve, any future `bulk-urls` omission — a genuinely
unreferenced asset, a soft-deleted one, a network failure — reproduces the same
misleading UI. PRD §8.

## The change

In `frontend/src/features/assets/components/AttachmentCell.tsx`:

**1. Distinguish three states, not two.** Today "loading" and "resolved but
absent" are both `undefined`. Use the `useAssetUrls` query status so the cell
can tell them apart: pending → a loading affordance; settled with no entry →
unavailable; settled with an entry → today's behavior.

**2. Tile.** Render a distinct `attachment-unavailable` tile — visually clearly
not-a-file, with a tooltip explaining it. Do not reuse `attachment-doc-thumb`;
the whole point is that it must not look like a normal attachment.

**3. Modal.** Replace the `FILE / File` panel with an explicit statement that
the file is unavailable, and suppress the Download/Open actions that cannot
work. If Phase 04 has landed, reuse its message mapping so the wording is
identical in both places.

**4. Header.** Do not fall back to the raw asset id
(`asset_20260709170202490275` was the modal title in Ed's screenshot). Prefer the
row/field context — "Unavailable attachment" reads better than an internal
identifier the user cannot act on.

## Design system

Check `context/DESIGN_SYSTEM.md` for an existing empty/error/unavailable
component before writing CSS. Reuse before inventing — the guards reject
off-system CSS, and this is a small enough surface that a token-level style on
an existing component should cover it. If a new component is genuinely needed,
it belongs in the blessed inventory, so raise it rather than one-off styling it
inside `AttachmentCell`.

## Tests

1. Component: an asset id absent from `assetUrlById` after the query settles
   renders the unavailable tile, not `FILE`.
2. Component: while the query is pending, it renders the loading affordance —
   not the unavailable tile.
3. Component: the modal for an unresolvable asset shows the unavailable message
   and offers no Download or Open action.
4. Regression: a resolvable non-image, non-PDF asset still renders the normal
   `FILE` glyph and its working actions. The point is to distinguish the two
   cases, not to relabel every non-previewable file.

## Verification

- `make ci` green; `pnpm run format`.
- Manual, signed out, per `context/USING_A_WEB_BROWSER.md`: with an
  intentionally unreferenced asset id in a cell, the tile reads as unavailable
  and the modal explains it.
- Manual: a normal PDF attachment is unchanged — thumbnail, iframe preview,
  Download, Open in new tab.

## Completion evidence

- `AttachmentCell` now distinguishes pending URL resolution, a settled missing
  asset, and a resolved asset. The unavailable tile and modal reuse the Phase 04
  error copy, expose no raw asset id, and suppress impossible Download/Open
  actions.
- External URL maps and their pending status are a type-enforced pair. Every
  shared-map producer passes `isPending`; the Documentation viewer now reuses
  the same read-only `AttachmentCell` instead of maintaining a second renderer.
- Component/API/DataTable focused bundle: `29 passed`, including all four tests
  listed above and the external-map loading regression.
- Signed-out local browser: a temporarily soft-deleted Thermal Bridges PDF
  rendered `Unavailable attachment`; its modal showed the mapped message with
  no Download/Open actions and no raw id. The exact database row was restored
  immediately and verified.
- Signed-out local browser after restore: the PDF tile, iframe, Download, and
  Open in new tab remained unchanged.
- Three parallel `simplify` reviews and rechecks completed with no remaining
  correctness, reuse, or efficiency findings.
- `graphify update .` completed. The docs pass found no new architectural rule
  requiring a context doc or ADR; this phase refines the established attachment
  presentation contract.
- Full `make ci` green: backend `1830 passed, 7 skipped`; frontend `2389
  passed`; formatting, lint, types, boundaries, contract checks, and production
  build passed.

## Risks

- **Over-reach.** Test 4 is the guard: do not turn every un-thumbnailed file
  into an error state. Only "resolved and absent" is unavailable.
- Thumbnail generation is asynchronous and best-effort
  (`complete_upload` schedules it as a background task). A freshly uploaded PDF
  can legitimately have a resolvable `AssetUrls` with no `thumbnail_url` — that
  is the normal `FILE` glyph path, not the unavailable path. Do not conflate a
  missing thumbnail with a missing asset.

## Done when

- The three states are visually distinct.
- Tests 1–4 pass.
- A normal attachment is provably unchanged.
