---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Done — implemented + tested 2026-06-24 (menu item, preflight→modal flow, blob download)
AUTHOR: Ed (via Claude)
SCOPE: Frontend — API client, export hook + preflight, menu item, draft
  warning, confirm/cancel error modal, blob download.

> Built note: the preflight→modal→download flow is encapsulated in a
> `useEnvelopePhppExport` controller hook (mirroring `useEnvelopeHbjsonImport`)
> rather than inline in `EnvelopePage.tsx`; the page consumes `phpp.start()` /
> `phpp.confirm()` / `phpp.reset()` / `phpp.blocked`. The draft-export warning
> is the shared `confirmDraftExport` helper in `page-helpers.ts`.
RELATED: ../PRD.md (§2, §9), ../research.md (§1, §6, §8)
---

# Phase 3 — Frontend wiring

Goal: thin client that drives preflight → modal → download, passing the live
unit preference. No conversions or eligibility logic on the client.

## API — `frontend/src/features/envelope/api.ts`

- `fetchPhppPreflight(projectId, versionId, signal?) -> PhppPreflightResponse`
  → `fetchJson(GET …/envelope/export/phpp/preflight)`.
- `downloadEnvelopePhpp(projectId, versionId, units) -> Blob`
  → `fetchBlob(GET …/envelope/export/phpp?units=${units})`.

## Types — `frontend/src/features/envelope/types.ts`

- `PhppPreflightItem = { id; name; exportable; reason: string | null }`
- `PhppPreflightResponse = { assemblies: PhppPreflightItem[] }`

## Hook — `frontend/src/features/envelope/hooks.ts`

- `useEnvelopePhppExportMutation(projectId, versionId)`:
  `mutationFn(units)` → `downloadEnvelopePhpp(...)` → `downloadBlob(blob,
  "phpp-u-values-${units}-${versionId}.zip")`. (Mirror
  `useEnvelopeHbjsonExportMutation`.)
- Preflight: a `useMutation` (imperative, on click) or `useQuery` gated to the
  click. Prefer a mutation so it runs only when the user asks.

## Page — `frontend/src/features/envelope/routes/EnvelopePage.tsx`

- New `AppMenuItem` "Download in PHPP format" under the HBJSON item, disabled
  while the PHPP export/preflight is pending.
- New handler `exportPhpp()`:
  1. Same draft warning as `exportHbjson` (`source === "draft" &&
     draft_etag` → `window.confirm(...)`; bail on cancel).
  2. `units = useUnitPreference().unitSystem`.
  3. `const preflight = await preflightMutation.mutateAsync()`.
  4. `const blocked = preflight.assemblies.filter(a => !a.exportable)`.
  5. If `blocked.length` → open the error modal (state), passing `blocked` +
     `units`; the modal's "Download anyway" calls the export; "Cancel" closes.
  6. Else → `await exportMutation.mutateAsync(units)` directly.
  - Errors → reuse `setCommandError` / `exportErrorDetails` pattern.

## Modal — new `frontend/src/features/envelope/components/PhppExportWarningDialog.tsx`

- Built on `ModalDialog` + `DialogActions`.
- Title e.g. "Some assemblies can't be exported to PHPP".
- Body: list each blocked assembly name + a friendly reason
  (`too_many_layers` → "more than 8 layers"; `too_many_pathways` → "more than
  3 heat-flow pathways"; `incomplete_materials` → "missing materials or
  conductivities").
- `DialogActions` with `submitLabel="Download anyway"` (`onConfirm` → export),
  Cancel → `onClose`. `busy` bound to export pending.

## Tests — `frontend/src/features/envelope/__tests__/`

- Vitest: hook builds correct URL incl. `units`; `downloadBlob` invoked with
  the right filename (mock it).
- Modal renders blocked assemblies + reasons; "Download anyway" fires export,
  "Cancel" does not.
- Menu shows the new item only on the assemblies route, disabled while pending.
- `pnpm run format` after changes.

## Done when

`make frontend-dev-check` green; the menu item, draft warning, modal, and
download all work against the local backend.
