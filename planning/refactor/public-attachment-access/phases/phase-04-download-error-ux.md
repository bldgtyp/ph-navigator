---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Not started
AUTHOR: Claude with Ed May
SCOPE: Replace hard navigations to the API origin with in-app error handling,
  and stop the API from returning a bare JSON body to a browser navigation.
RELATED:
  - ../PRD.md
  - ./phase-05-unavailable-state.md
---

# Phase 04 — Downloads never show a raw error

## Goal

No user-facing action can replace the app with a raw API error body. A failed
download produces an in-app message that names what happened.

## Depends on

Nothing. Independent of the backend bundle and shippable on its own.

## The defect

Every download affordance is an `<a href>` (or `window.location.href`) pointing
at `api.ph-nav.com`. The browser navigates away, so any non-2xx response *is*
the page — which is how Ed's certifier got
`{"error_code":"asset_not_referenced", …}` as a full-screen document. This is
independent of the reference bug and survives Phases 01–02: 404, `410
project_deleted`, `409 asset_upload_incomplete`, and an expired session all
produce the same experience. PRD §7.

Call sites:

- `frontend/src/features/assets/components/AttachmentCell.tsx:294`
- `frontend/src/features/assets/components/AttachmentRowsTable.tsx:115`
  (`window.location.href`)
- `frontend/src/features/projects/components/ProjectLocationSummary.tsx:77`
- `frontend/src/features/climate/components/ClimateSourceDetailPage.tsx:535`

## The change — client

Add one shared helper in `frontend/src/features/assets/api.ts`:

```
downloadAsset(projectId, assetId): Promise<void>
```

It fetches `GET /assets/{id}/url`, then triggers the download from the returned
signed `download_url`. On a non-2xx it throws a typed error carrying
`error_code`, the human message, and `request_id`.

Convert all four call sites to it. One helper, four conversions — do not
duplicate the mapping logic per call site.

Keep `assetDownloadPath` only if something still needs a bare URL (e.g. a
right-click "copy link"); otherwise remove it so the pattern cannot come back.

### Message mapping

Map `error_code` to plain language. Ed's standing preference: never show a raw
error string, and say what the user can do.

| `error_code` | Message |
| --- | --- |
| `asset_not_referenced` | "This file isn't part of the shared view. Ask the project owner to attach it." |
| `asset_not_found` | "This file is no longer available." |
| `asset_upload_incomplete` | "This file is still uploading — try again in a moment." |
| `project_deleted` | "This project has been deleted." |
| `not_authenticated` | "Your session expired. Sign in again to download." |
| anything else | generic failure + the `request_id`, so support has a thread to pull |

Surface through the existing toast / inline-error component. Do not introduce a
new error surface — check `context/DESIGN_SYSTEM.md` for the blessed one and
reuse it.

## The change — server

The raw JSON page is still reachable by pasting an API URL into the address bar,
which is a real thing a certifier might do with a copied link. Content-negotiate
in `backend/features/assets/routes.py` on the `/download` route: when the
request `Accept`s `text/html`, return a minimal HTML error page (or redirect to
the app with an error parameter) instead of the JSON body. JSON stays the
default for API clients.

Keep it small — this closes the class rather than the instance, and it is the
difference between "we fixed the four links we knew about" and "the endpoint
cannot embarrass us."

## Tests

1. Unit: `downloadAsset` maps each `error_code` in the table to its message, and
   an unmapped code to the generic message including `request_id`.
2. Component: a failing download in `AttachmentCell` renders the in-app error and
   does **not** navigate.
3. Backend: `GET /assets/{id}/download` with `Accept: text/html` on a 403
   returns HTML, not `application/json`; with `Accept: application/json` it
   still returns the JSON error contract unchanged.
4. Backend: the success path still 307-redirects to the signed URL for both
   accept types.

## Verification

- `make ci` green; `pnpm run format` after frontend changes.
- Manual, signed out: force a failure (attach an asset, open the modal, detach
  it in another session, then click Download) and confirm an in-app message
  appears and the app is still on screen.
- Paste an `/assets/{id}/download` URL for an unreferenced asset directly into
  the address bar → an HTML error page, not JSON.

## Risks

- **Popup blocking.** Fetch-then-navigate can trip popup blockers if the
  navigation is no longer in the user gesture's call stack. Prefer assigning
  `location.href` / a synthesized `<a download>` click in the same task after
  the URL resolves, and verify in Chrome and Safari.
- Four call sites in three features — keep the diff mechanical and let the
  `simplify` skill review it.

## Done when

- No user-facing surface navigates to the API origin for a download.
- Tests 1–4 pass.
- The manual checks above are confirmed.
