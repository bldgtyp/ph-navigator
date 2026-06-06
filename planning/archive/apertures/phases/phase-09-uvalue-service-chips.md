---
DATE: 2026-06-05
TIME: 19:30 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Port the V1 ISO 10077-1 aperture U-Value calculation into
       V2, wire a per-aperture and per-element cache keyed on a
       content hash that explicitly excludes `operation` and
       `name`, ship the Apertures-tab header `Window U-Value` chip
       and the per-element card chip, surface the "unfinished"
       qualifier when assignments are missing, and add the info
       tooltip explaining no-films / no-operation convention.
RELATED:
  - planning/features/apertures/PRD.md §14, §11 (chip placeholder),
    §22 (acceptance summary)
  - planning/features/apertures/PLAN.md (Phase 09 row, R6)
  - ../ph-navigator/backend/features/aperture/services/window_u_value.py
    (V1 source — port target)
  - context/GLOSSARY.md (U-Value vs U-Factor convention)
  - phase-06 (cards delivered chip placeholder; this phase fills
    the value)
---

# Phase 9 — U-Value service + display chips

## Implementation note (Claude, 2026-06-05)

Shipped as a single PR. See STATUS.md "Phase 09 deviations from
the doc" for the per-decision rationale. Highlights:

- Backend module lives at `backend/features/aperture_u_value/`
  with the standard `service.py` / `models.py` / `cache.py` /
  `routes.py` split. Algorithm mirrors V1 line-for-line
  (corner 45° split, frame Q + spacer Ψ, area-weighted aggregate).
- Cache is a FIFO-bounded ``OrderedDict``-backed class — strict
  LRU would trip `ty`'s Liskov check against `dict.get`.
- Content hash excludes operation and name; passes a unit test
  showing tilt-turn ↔ Fixed yields the same hash.
- Mutation hook invalidates the U-value query when the command
  kind is in a client-side ``U_VALUE_AFFECTING_KINDS`` set;
  ``setElementOperation`` and ``setElementName`` are absent.
- Chip uses the native ``title`` for the PRD §8 tooltip copy.
- Backend test fixtures derive expected ranges rather than
  copying V1's fixture corpus (V1 lives in
  ``../ph-navigator/`` which V2 doesn't depend on at CI time).

## Original Phase 09 plan follows.

## P0. Why this slice

Phase 09 is the **thermal performance feedback loop**. The user
edits the canvas; within a few hundred milliseconds the chip in
the Builder header and the chip on each element card updates with
a fresh ISO 10077-1 composite U-Value. Operation changes do not
trigger a refetch (excluded from the content hash). Missing or
hand-entered assignments are surfaced as `(unfinished)` rather
than silently returning a wrong number.

The V1 service at
`../ph-navigator/backend/features/aperture/services/window_u_value.py`
is the parity target. Tests port the V1 fixtures verbatim before
any V2-specific cleanup.

By the end of Phase 09:

- A new backend service at
  `backend/features/aperture_u_value/service.py` computes per-
  element and per-aperture U-Values per ISO 10077-1.
- The service is cached by a content hash of the U-Value-affecting
  subtree (`row_heights_mm`, `column_widths_mm`, each element's
  four frames + glazing). `operation` and `name` are explicitly
  excluded.
- A REST endpoint `GET /projects/{id}/versions/{vid}/apertures/u-values?
  source=draft|version` returns
  `{ apertures: [{ aperture_type_id, window_u_value_w_m2k,
  elements: [{ element_id, u_value_w_m2k }], warnings: [...] }] }`.
- The Apertures-tab header chip `Window U-Value:` populates with
  the active aperture's value; the per-element card chip
  populates with the element's value.
- IP / SI labelling honors the project's unit system; tooltip
  matches PRD §8.
- Broken / null assignments render `(unfinished)` with italic muted
  styling; the tooltip names which elements are missing
  assignments. The number still renders.
- Debounce: 300 ms after the last document mutation; immediate
  refetch on aperture-type switch.
- Locked / Viewer: chip and tooltip render the same — value is
  data, not edit state.

Phase 09 does **not** ship the HBJSON export (Phase 10 reads the
per-element U-Value), manufacturer filters (Phase 11), or refresh
dialog (Phase 12). Phase 09 ships the cache invalidation seam;
Phase 10 hooks it for the export contract.

## P1. Acceptance — Phase 9 done when

1. `backend/features/aperture_u_value/` (new module) ships:
   - `service.py` — `calculate_aperture_u_values(aperture: ApertureTypeEntry)
     -> ApertureUValueResult` (per-element + window-level). Pure
     function, no side effects.
   - `models.py` — `ApertureUValueResult`,
     `ApertureElementUValue`, `ApertureUValueWarning`.
   - `cache.py` — content-hash + LRU cache keyed by hash. Hash
     algorithm SHA-256 over a canonical-JSON representation of
     the U-Value-affecting subtree. `operation` and `name` are
     excluded from the canonical representation.
   - `routes.py` — `GET /projects/{id}/versions/{vid}/apertures/u-values`
     accepts `source=draft|version` (defaults to whichever the
     project document service resolves for the user).
   - `__tests__/` — V1 fixture parity plus V2 corner cases.
2. **ISO 10077-1 formula** (V1 parity):
   - `Uw = (Σ A_g × U_g + Σ A_f × U_f + Σ l_g × Ψ_g) / Σ (A_g + A_f)`
   - `A_g` per element = glazing rect area (mm²).
   - `A_f` per element = sum of four frame rect areas (mm²).
   - `l_g` per side = visible glazing perimeter edge length on
     that side (mm). For a rectangular glazing, that is the
     length of the side adjacent to the frame.
   - `Ψ_g` per side = `frame.psi_g_w_mk`.
   - **Operation excluded.** `psi_install_w_mk` stored but not
     used in the uninstalled Uw (matches PRD §14 + V1).
3. **Per-element U-Value** uses the same formula scoped to the
   element only.
4. **Warning model** (`ApertureUValueWarning`):
   - `kind: "missing_frame" | "missing_glazing" | "missing_dimension"`
   - `element_id` / `side` / `axis` as relevant.
   - The service returns the warnings array alongside the value;
     it never raises on missing assignments because Phase 01's
     default-refs guarantees normal apertures are complete and
     the warning path exists only for legacy / imported / broken
     documents.
5. **Cache**:
   - `content_hash_for_aperture(entry)` is canonical-JSON of the
     subtree minus `operation` + `name` minus all `local_overrides`
     metadata (overrides are reflected in the underlying field
     values, so they're already in the hash).
   - LRU 256 entries. Process-local; not Redis-backed in v1.
   - Cache miss recomputes; hit returns instantly.
6. **REST endpoint**:
   - Reads the project document at the requested source.
   - Iterates apertures; computes each via the service.
   - Returns the same response shape as the V1 endpoint where
     possible (PRD §17 keeps HBJSON parity; this endpoint is V2-
     native but the shape is documented in `context/`).
   - Response includes a `content_hash` field per aperture so
     the frontend can detect identity-of-result during refetch.
7. **Apertures-tab header chip**:
   - `<UValueChip />` already exists from Phase 02 with a
     placeholder `--`. Phase 09 populates it.
   - SI: `Window U-Value: 1.20 W/m²K` (2 dp).
   - IP: `Window U-Value: 0.21 BTU/(hr·ft²·°F)` (2 dp).
   - `min-width: 200px` to prevent layout shift.
   - Info icon (`Info` lucide) opens a tooltip with the exact
     copy from PRD §8 + GLOSSARY (no-films, no-operation,
     ISO 10077-1 reference).
8. **Per-element card chip**:
   - Renders top-right of each `<ApertureElementCard />`.
   - Same format as header chip, smaller font.
9. **Unfinished qualifier**:
   - When any element in the active aperture has at least one
     `ApertureUValueWarning`, the header chip appends `
     (unfinished)` italic + muted.
   - Tooltip extends with `N elements are missing a frame or
     glazing assignment. The value above is computed from the
     picked elements only.` listing element names.
10. **Refetch behavior**:
    - Debounced 300 ms after any draft mutation that the audit
      envelope flags `affects_u_value=true` (Phase 06 / 08 /
      others set this flag explicitly).
    - Operation changes have `affects_u_value=false` (Phase 07
      sets this), so the refetch does **not** fire.
    - Aperture-type switch is immediate (no debounce).
    - TanStack Query keys: `["apertures-u-values", projectId,
      versionId, source]`.
11. Locked / Viewer access: chip renders the same; tooltip
    works the same.
12. `make ci` is green.

## P2. Files

### New (backend)

- `backend/features/aperture_u_value/__init__.py`
- `backend/features/aperture_u_value/service.py`
- `backend/features/aperture_u_value/models.py`
- `backend/features/aperture_u_value/cache.py`
- `backend/features/aperture_u_value/routes.py`
- `backend/features/aperture_u_value/__tests__/test_service.py`
- `backend/features/aperture_u_value/__tests__/test_cache.py`
- `backend/features/aperture_u_value/__tests__/test_routes.py`
- `backend/features/aperture_u_value/__tests__/fixtures/v1_parity_*.json`
  (lifted from the V1 service test corpus)

### New (frontend)

- `frontend/src/features/apertures/components/UValueChip.tsx`
  (the shared chip — header + card use the same primitive,
  parameterized by `compact: boolean` and `value`).
- `frontend/src/features/apertures/components/UValueInfoTooltip.tsx`
- `frontend/src/features/apertures/hooks/useApertureUValues.ts`
- `frontend/src/features/apertures/lib/formatUValue.ts`
- `frontend/src/features/apertures/__tests__/formatUValue.test.ts`
- `frontend/src/features/apertures/__tests__/UValueChip.test.tsx`

### Modified

- `frontend/src/features/apertures/components/AperturesHeader.tsx`
  - Replace Phase 02's static `Window U-Value: --` with
    `<UValueChip />` reading from `useApertureUValues`.
- `frontend/src/features/apertures/components/ApertureElementCard.tsx`
  - Replace the Phase 06 placeholder with a real `<UValueChip
    compact />`.
- `backend/features/project_document/aperture_commands/handlers/*.py`
  - Audit envelopes for `pickFrame`, `pickGlazing`,
    `editFieldOverride`, `addRow`, `addColumn`, `deleteRow`,
    `deleteColumn`, `editDimension`, `mergeElements`,
    `splitElement`, `pasteAssignment` set `affects_u_value=True`
    if not already.
  - `setElementOperation` and `setElementName` set
    `affects_u_value=False`.
- `backend/main.py` — mount the new
  `aperture_u_value/routes.py` router.

### Deleted

None.

## P3. Component / model shapes

```python
# backend/features/aperture_u_value/service.py — sketch

@dataclass(frozen=True)
class ApertureElementUValue:
    element_id: str
    u_value_w_m2k: float
    area_m2: float
    warnings: list["ApertureUValueWarning"]


@dataclass(frozen=True)
class ApertureUValueResult:
    aperture_type_id: str
    window_u_value_w_m2k: float
    elements: list[ApertureElementUValue]
    warnings: list["ApertureUValueWarning"]
    content_hash: str


def calculate_aperture_u_values(entry: ApertureTypeEntry) -> ApertureUValueResult:
    hash_value = content_hash_for_aperture(entry)
    cached = _CACHE.get(hash_value)
    if cached is not None:
        return cached

    element_results: list[ApertureElementUValue] = []
    total_q = 0.0
    total_area = 0.0
    for element in entry.elements:
        per_el = _calculate_element(entry, element)
        element_results.append(per_el)
        total_q += per_el.u_value_w_m2k * per_el.area_m2
        total_area += per_el.area_m2

    window_u = total_q / total_area if total_area > 0 else 0.0

    result = ApertureUValueResult(
        aperture_type_id=entry.id,
        window_u_value_w_m2k=window_u,
        elements=element_results,
        warnings=collect_warnings(element_results),
        content_hash=hash_value,
    )
    _CACHE[hash_value] = result
    return result
```

```python
# backend/features/aperture_u_value/cache.py — sketch

def content_hash_for_aperture(entry: ApertureTypeEntry) -> str:
    payload = {
        "row_heights_mm": entry.row_heights_mm,
        "column_widths_mm": entry.column_widths_mm,
        "elements": [
            {
                "id": el.id,
                "row_span": list(el.row_span),
                "column_span": list(el.column_span),
                "frames": {
                    side: _frame_hash_payload(frame)
                    for side, frame in {
                        "top": el.frames.top,
                        "right": el.frames.right,
                        "bottom": el.frames.bottom,
                        "left": el.frames.left,
                    }.items()
                },
                "glazing": _glazing_hash_payload(el.glazing),
                # `name` and `operation` deliberately excluded.
            }
            for el in entry.elements
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()
```

```ts
// frontend/src/features/apertures/hooks/useApertureUValues.ts — sketch

export function useApertureUValues(
  projectId: string,
  versionId: string,
  source: "draft" | "version",
) {
  return useQuery({
    queryKey: ["apertures-u-values", projectId, versionId, source],
    queryFn: () => fetchApertureUValues(projectId, versionId, source),
    staleTime: 0,
  });
}

export function useApertureUValuesAutoRefetch(
  projectId: string,
  versionId: string,
) {
  const queryClient = useQueryClient();
  const draftStateRef = useDraftAuditEvents();  // streams audit envelopes
  useEffect(() => {
    const unsub = draftStateRef.subscribe((event) => {
      if (event.affects_u_value) {
        scheduleDebounced(() =>
          queryClient.invalidateQueries({
            queryKey: ["apertures-u-values", projectId, versionId, "draft"],
          }),
          300,
        );
      }
    });
    return unsub;
  }, [projectId, versionId, queryClient, draftStateRef]);
}
```

## P4. Sequence

1. **Commit 1 — Backend service + cache (no routes).** Port the
   V1 calculation into `service.py`. Add `cache.py`. Tests in
   `test_service.py` lift every V1 fixture verbatim plus four
   new corner cases (null frame, null glazing, single-cell
   aperture, 2×2 with merged element).
2. **Commit 2 — Routes + REST contract.** Add
   `routes.py` + `test_routes.py`. Document the response shape
   in `context/technical-requirements/aperture-u-value-api.md`.
3. **Commit 3 — Audit envelope flag.** Backfill the
   `affects_u_value` flag on every existing aperture-command
   handler.
4. **Commit 4 — Frontend hook + chip + tooltip.** Wire
   `useApertureUValues`, replace the header and card
   placeholders with the real chip.
5. **Commit 5 — Auto-refetch debounce.** Wire
   `useApertureUValuesAutoRefetch` and verify that operation
   changes do not refetch.
6. **Commit 6 — Unfinished qualifier + tooltip polish.**
   `make ci` green.

## P5. Tests

### Backend — service

- V1 parity: for every V1 fixture, the computed
  `window_u_value_w_m2k` and per-element values match within
  `1e-6`.
- Null glazing → warning `missing_glazing`; value falls back to
  picked-elements-only.
- Null frame on one side → warning `missing_frame`; value
  computed from the picked sides.
- Content hash is stable across `operation` toggles: changing
  `element.operation` from `null` to `swing+[left]` returns the
  same hash.
- Content hash differs after a `psi_g_w_mk` inline override.

### Backend — cache

- Same input twice → second call hits the cache; service body
  not re-entered.
- LRU eviction at 257th distinct hash.

### Backend — routes

- `GET ?source=draft` returns the draft body's values.
- `GET ?source=version` returns the saved version's values.
- Locked / Viewer access: GET works (read-only data).

### Frontend — chip + hook

- `formatUValue(1.2, "si") === "Window U-Value: 1.20 W/m²K"`.
- `formatUValue(1.2, "ip") === "Window U-Value: 0.21 BTU/(hr·ft²·°F)"`
  (sanity-check the SI→IP conversion factor).
- Chip renders `--` while loading.
- Chip renders the value + `(unfinished)` qualifier when warnings
  are present.
- Tooltip text matches PRD §8 verbatim.
- After a `pickFrame` mutation (mocked audit envelope with
  `affects_u_value=true`), the chip refetches after 300 ms.
- After a `setElementOperation` mutation (mocked audit envelope
  with `affects_u_value=false`), the chip does **not** refetch.

### Browser

- Open a 2×2 aperture; verify the header chip shows the
  expected value.
- Edit a dimension; verify the chip updates after ~300 ms.
- Change the operation on one element; verify the chip does
  **not** update.
- Pick a different frame; verify the chip updates.
- Flip view direction; verify the chip is unchanged (view
  direction does not affect Uw).

## P6. Out of scope (lands in later phases)

- HBJSON export consumes the per-element U-Value — Phase 10.
- Manufacturer filters — Phase 11.
- Refresh-from-catalog dialog — Phase 12.
- MCP `calculate_aperture_u_values` semantic tool wraps the
  REST endpoint — Phase 13.

## P7. Risks

- **R-09-1. V1 calc may have hidden assumptions about
  spacer-length convention.** Mitigation: V1 fixtures are the
  contract; the V2 port must reproduce them within `1e-6`. Any
  V1-suspected bug surfaces as a fixture mismatch and is
  resolved by `cd ../ph-navigator && grep`-driven archaeology
  before the PR opens.
- **R-09-2. Cache invalidation crosses process boundaries.**
  Mitigation: cache is process-local in v1 (LRU dict). If the
  app scales out, the cache becomes a per-pod thing; future
  Redis-backed cache is a follow-up phase.
- **R-09-3. Frontend debounce + draft buffer interaction.**
  Mitigation: the debounce key is the aperture type id; rapid
  edits to different apertures don't get blended. The audit
  event subscription is unique per (project, version).
- **R-09-4. (unfinished) qualifier could be alarming for a
  freshly-created aperture.** Mitigation: Phase 01's
  default-refs guarantee new apertures have non-null
  assignments, so the qualifier only appears on legacy /
  imported documents. The tooltip text names which elements
  are missing.
- **R-09-5. IP / SI conversion factor.** Mitigation: a single
  `convertSIToIP` constant in `formatUValue.ts`,
  unit-tested against the expected factor
  (`1 W/m²K = 0.1761 BTU/(hr·ft²·°F)`).
