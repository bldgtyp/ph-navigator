# Assembly-Builder Comprehensive Review

DATE: 2026-06-07
TIME: 16:00 ET
SCOPE: `backend/features/envelope/` + `backend/tests/envelope/` + `frontend/src/features/envelope/`
PRIOR REVIEW: `planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md`
TOTAL LOC IN SCOPE: ~8,050 (BE ~1,900 / FE ~5,000 / tests ~1,150)

## Headline

The Assembly-Builder is structurally **sound** and notably disciplined for a feature of this size and interactivity. The backend layering (routes → service → ops/commands → repository) holds cleanly, the command pattern is well-executed, the SVG-canvas / DOM-overlay split is the right architecture, and prior code-review findings from 2026-05-27 (god service file, isinstance dispatch, oversized frontend files) are **substantively resolved**. The feature is ready for the next product phase.

That said, the review surfaced **one real correctness bug** (rename_assembly does not enforce name uniqueness), **two high-value refactors** worth doing before extending further (extract `usePaintMode`, deduplicate material-form code), **meaningful test gaps** (thermal multi-segment math is silently unexecuted; 9 command kinds untested), and **significant documentation drift** (the apertures HBJSON-export contract has shipped an opaque-construction sibling with no doc anchor; the May 27 review reads as live but is fully resolved).

Sequencing recommendation at the bottom.

---

## Top-Priority Findings (must- or should-do before next phase)

| # | Finding | Severity | Effort | Where |
|---|---------|----------|--------|-------|
| 1 | `rename_assembly` does not check name uniqueness; `create_assembly` and `duplicate_assembly` do | **Bug** | Small | `commands/assemblies.py:45-50` |
| 2 | Thermal multi-segment math path is completely untested (the reason both ASHRAE methods exist) | **Test gap** | Small-Medium | `thermal.py:130-141`, `163-169` |
| 3 | Opaque-construction HBJSON export contract is undocumented (parallel doc to `hbjson-export.md` missing) | **Doc gap** | Small | new `context/technical-requirements/envelope-hbjson-export.md` |
| 4 | Extract `usePaintMode` hook out of `EnvelopePage.tsx` (largest extractable block, ~80 lines) | Refactor | Medium | `EnvelopePage.tsx:91-340` |
| 5 | `ProjectMaterialEditor` ↔ `MaterialDriftDialog` duplicate frozen-unit + parseMaterialNumbers logic | Refactor | Small | both files |
| 6 | `assembly-builder-foundation-review.md` reads as live but every H1/H2 item is resolved | Doc rot | Small | add resolution header |
| 7 | 9 command kinds have no direct test (`update_assembly_type`, `delete_assembly`, `flip_orientation/layers`, `add_layer`, `add_segment`, `update_segment`, `delete_segment`, `pick_project_material`) | Test gap | Medium | `tests/envelope/` |
| 8 | `EnvelopePage.test.tsx` at 1,149 lines should split along feature seams (6 candidate files) | Maintainability | Medium | tests reorg |

---

## 1. Backend Review

### 1.1 Architectural assessment

Layer separation is **clean and well-enforced**. Routes delegate immediately to service functions with no logic of their own. Service owns policy (ETag protection, draft/version branching, audit, no-op short-circuit). Ops owns document-model mutation primitives. Commands own semantic intent. Repository is deliberately empty because envelope lives inside the JSONB document — correctly documented.

`registry.py`'s `_body_only` adapter is an elegant pattern for distinguishing document-only commands from the two DB-touching ones (`pick_catalog_material`, `refresh_project_material_from_catalog`). `drift.py`, `thermal.py`, `hbjson_export.py` are appropriate siblings — pure read-side derivations, no mutation responsibility.

### 1.2 Real bug: `rename_assembly` skips uniqueness check

`commands/assemblies.py:45-50`:

```python
def rename_assembly(body, command):
    return ops.update_assembly(
        body,
        command.assembly_id,
        lambda assembly: assembly.model_copy(update={"name": command.name}),
    )
```

`create_assembly` (line 21) calls `ops.ensure_unique_assembly_name`. `duplicate_assembly` (line 72) calls it. `rename_assembly` does not. The invariant "assembly names are unique after trim/case-fold" silently breaks on rename. The case-fold trim is also missing (vs. `command.name.strip()` in `duplicate_assembly`). Two lines to fix, plus a regression test.

### 1.3 Refactoring opportunities (prioritized)

1. **`replace_assemblies` / `replace_project_materials` round-trip through full `validate_document`** on every mutation (`ops.py:84-95`). `model_copy(update=...)` chain would skip cross-table revalidation. Medium effort, becomes relevant as document grows.
2. **`_load_command_context` returns a 4-tuple** (`service.py:242-283`); the `base_version_etag` vs `version_etag` distinction is invisible at call sites. Small `@dataclass CommandContext` would clarify. Small effort.
3. **`table_contracts.apply_assembly_segments_replace`** does a typed-then-raw two-pass walk (`table_contracts.py:96-130`) with a `str(segment.get("id", ""))` guard that would silently miss a future schema change. Single-pass `model_copy` cleanup. Small effort.
4. **`AssemblyThermalStatus` docstring is stale** (`models.py:29`): says "Placeholder until Phase 5 adds calculations" — Phase 5 shipped. Trivial.
5. **`ops.not_found` reads as a predicate but is `NoReturn`** (`ops.py:202`). `raise_not_found` would be clearer. Trivial.

### 1.4 Code reuse findings

- **Duplicate `materials_by_id` dict** built in `service.py:108`, `selectors.py:18`, `selectors.py:66`, `hbjson_export.py:23`. One-liner so harmless, but a named `_index_materials(materials)` helper would improve grep-ability.
- **Delete-then-guard duplication** in `delete_layer` and `delete_segment` (`layers.py:51`, `layers.py:91`): both check `len == 1` then redundantly check `any(... id ==)` — the existence check is already covered by `ops.update_assembly`'s traversal. Cleanup, not safety.
- **`hbjson_export._material_identifier`** uses `thickness_mm / 25.4` with no comment on the Honeybee imperial convention (`hbjson_export.py:193-194`). One-line comment.

### 1.5 Size/complexity hotspots

- `models.py` (445 lines): **leave it.** 22 command models + 8 read models, 5-15 lines each, no logic. Splitting would fragment a natural browsing surface.
- `thermal.py` (282 lines): **leave it.** Clean internal call graph, each method under 25 lines.
- `service.py` (283 lines): `apply_envelope_command` is 70 lines but most is the no-op response builder — could extract for clarity but not urgent.
- `commands/materials.py` (325 lines): largest command module; `refresh_project_material_from_catalog` (~44 lines) is the most complex but is straightforward sequential validation. Fine.

### 1.6 Backend strengths

- **ETag design (`service.py`)** is the strongest piece: dual-ETag (version vs draft), no-op short-circuit without writing a draft row, conflict payloads carry `expected` for client recovery.
- **Functional update pattern in `ops.py`**: `Callable[[Assembly], Assembly]` updaters compose cleanly through `update_assembly → update_layer → update_segment`, mirroring the domain hierarchy.
- **`thermal.py` correctness**: Parallel-Path + Isothermal-Planes match ASHRAE Ch. 25; PH-average for `r_effective` is the standard construction-preview approach; `thermal_input_hash` correctly hashes only physically-relevant fields (no name/color).
- **`drift.py` separation**: catalog data is treated as immutable from the project's perspective; drift is advisory, never auto-applied. Correct PH-construction model.
- **Pydantic v2 hygiene** is clean throughout — `ConfigDict(extra="forbid")`, v2 validator signatures, `.model_dump(mode="json")` everywhere. No v1 residue.

---

## 2. Frontend Review — Canvas Layer

### 2.1 Architectural assessment

The three-layer canvas split — `AssemblySvgCanvas` (pure SVG render), `AssemblyCanvasOverlay` (DOM affordances), `AssemblyCanvas` (geometry coordinator + toolbar) — is **clean and earns its keep**. The SVG layer handles only visual representation; all interaction lives in the DOM overlay. This avoids the common mistake of mixing SVG event handling with DOM chrome and pays off in accessibility (ARIA, keyboard targets, sr-only text live in the overlay, not inside the SVG `role="img"`).

`AssemblyCanvasOverlay.tsx` at 437 lines is **not a god component** — it factors into four scoped private components (`LayerDimensionControls`, `LayerThicknessEditor`, `SegmentOverlay`, `SegmentAddControls`).

The main structural concern is **prop fan-out** through Workspace → Canvas → Overlay.

### 2.2 Refactoring opportunities

1. **Bundle toolbar callbacks into `AssemblyCanvasToolbarActions`** alongside the existing `AssemblyCanvasOverlayActions` pattern. `AssemblyWorkspace` carries 23 props; 8 canvas-action callbacks pass straight through. Reduces `AssemblyCanvas`'s prop count from 14 to ~9. Medium effort.
2. **`LayerThicknessEditor` reimplements `useLengthDraft`** (`AssemblyCanvasOverlay.tsx:140-252`): own `draft`/`error`/`committedRef` state, own parse/format calls, own stale-blur guard. The `committedRef` (lines 157, 175, 187) duplicates exactly what `useLengthDraft` was built to solve. Migrating would delete ~40 lines and close the silent divergent-validation-path risk. Medium effort.
3. **`EnvelopeEditorDialogs` final `return` is an implicit `delete-segment` branch** (`EnvelopeEditorDialogs.tsx:231-247`). TS-exhaustive but a future union member will silently fall through. Add explicit `if (dialog.kind === "delete-segment")` guard. Trivial.
4. **`SegmentActionsMenu` inline in `SegmentDialog.tsx:141-182`** — popper-menu pattern that will repeat. Extract to `shared/ui/` when a second use appears (not urgent).

### 2.3 Code reuse — what's working

- `useLengthDraft` is used correctly in `LengthDialog.tsx` and `SegmentDialog.tsx`; the unit-freeze contract is documented at the hook level.
- `CanvasAddButton`, `DialogActions`, `ModalDialog`, `materialColor`, `segmentCanvasKey` are all reused consistently with no reimplementation.

### 2.4 Size/complexity

- `AssemblyCanvasOverlay.tsx`: no function over 60 lines; `LayerThicknessEditor` JSX block is ~112 lines but reads as two clean branches.
- All `useEffect` chains in `EnvelopePage` and overlay have clean deps; no stale-closure risk observed.

### 2.5 CSS observations

`envelope.css` (~800 lines) uses a consistent BEM-influenced flat scheme: `assembly-canvas-*`, `assembly-layer-*`, `assembly-segment-*`, `dimension-chrome-*`, `material-legend-*`. The `dimension-chrome-*` sub-namespace introduced in recent commits is the most coherent. Two tooltip patterns (`data-toolbar-tooltip`, `data-sidebar-tooltip`) share ~30 lines of `::before`/`::after` mechanics — candidate for a base rule + modifier classes, but cosmetic.

### 2.6 Canvas-layer comment/naming gaps

- `committedRef` in `LayerThicknessEditor` (`AssemblyCanvasOverlay.tsx:157`) needs a WHY comment (the blur-after-Enter race is non-obvious).
- `LengthDialog.tsx:32` uses `label === "Thickness"` string-matching to switch unit-label style — brittle; needs either a prop or a comment.
- Frontend types in `types.ts` are hand-authored, not generated from backend. Maintenance surface; not a local bug.

### 2.7 Canvas-layer strengths

The SVG/DOM split, the `paint-mode` state machine (`idle → picking → picked → pasting` in pure `canvas-paint.ts`), `buildAssemblyCanvasGeometry` as a pure side-effect-free function, `useOutsidePointerDown` correctly scoping paint clearance, and the `EnvelopeEditorDialogs` discriminated-union switchboard are all production-grade choices.

---

## 3. Frontend Review — Page Layer

### 3.1 `EnvelopePage.tsx` (525 lines) — the size-exception is now weaker

The `// @size-exception` comment justifies the file on the grounds that "canvas/sidebar/specification layout details stay in feature components." That's still partially true. But the file now also owns a complete **paint-mode state machine** that has nothing to do with the cited justification. The page owns 19 distinct concerns (full inventory in the underlying review). Two extractions would land it around 420 lines:

1. **`usePaintMode` hook** [HIGH] — items 8, 17, 18 in the inventory: `paintMode`, `pickedAssignment`, `lastPaint`, `pastePulseKey`, `paintCommandInFlightRef`, six paint functions, the Escape-key effect, the pulse-timeout effect, and the `paintController` construction. ~80 lines, zero coupling to dialogs or routing. Largest extractable block in the file.
2. **`useEnvelopeDialogs` hook** [HIGH] — `dialog`, `catalogPickerOpen`, `refreshMaterialId`, `commandError`, plus the catalog-picker sync effect. ~20 lines. Synchronous-only.
3. **`useAssemblyRouting`** [MEDIUM] — the 5 `<Navigate>` early-return branches + derived `isAssembliesRoute` / `isSpecificationsRoute` / `assemblyId`. Wraps the routing guard wall.

### 3.2 Bugs / smells

- **`catalogPickerOpen` sync effect** (`EnvelopePage.tsx:143-145`): dependency array is `[catalogPickerOpen, dialog]` but the effect only needs `[dialog]` — current deps cause a no-op setState every time the picker toggles. Trivial cleanup.
- **Two in-flight guards wrap each other**: `paintCommandInFlightRef` (line 96) wraps `applyCommand` which itself sets `commandInFlightRef`. Behavior is correct but opaque; either rationalize or add a comment.
- **`refreshMaterialId` silently no-renders** the drift dialog if the material is stale post-reload (`EnvelopePage.tsx:510`). Low risk, worth noting.
- **`envelopeShellNotice` in `page-helpers.ts:25` is dead code** — exported, never called anywhere in the frontend (verified by grep). Delete.

### 3.3 Code-reuse — significant duplication

**`ProjectMaterialEditor` ↔ `MaterialDriftDialog`** share identical:
- `editorUnitSystem` frozen-on-mount pattern (`ProjectMaterialEditor.tsx:75-83`, `MaterialDrift.tsx:71-75`)
- `parseOptionalUnitNumber` calls for conductivity, density, specific heat (`ProjectMaterialEditor.tsx:125-135`, `MaterialDrift.tsx:247-254`)
- format helper imports and call patterns
- parse-error + external-error display pattern

Extract `useFrozenUnitOptions()` and `parseMaterialNumbers(form, unitOptions)`. Eliminates duplication across both files and any future material form. Small effort, high value as more material edit surfaces appear.

### 3.4 Other observations

- **`EnvelopeEditorDialogs.tsx`** if-chain (9 sequential `if (dialog.kind === ...)`) is currently fine; near the threshold where a `kind → render` lookup map starts to pay off.
- **`isDirty` in `ProjectMaterialEditor.tsx:88-89`** recomputes `formFromMaterial(material, unitOptions)` every render. Wrap in `useMemo`. Trivial perf cleanup, also clarity.
- **`page-helpers.ts` vs `lib.ts`**: scope distinction (page-only vs cross-component) is real but undocumented. One-line file headers would prevent drift.

### 3.5 Page-layer strengths

- Command dispatch (`applyCommand`) is the single chokepoint: in-flight guard, error reset, dialog close-on-success. No mutation logic leaks into components.
- Query-key hierarchy (`envelopeQueryKeys`) is clean; targeted invalidation (`invalidateMaterialDriftQueries`, `invalidateThermalQueries`) avoids broad invalidation.
- `EnvelopeCommand` discriminated union (18 variants) is comprehensive, narrows correctly downstream.
- The `@size-exception` annotation citing a specific prior review is itself a strength — exceptions are traceable.

---

## 4. Test Coverage

### 4.1 Backend

Tests are **at the right layer** (route + Postgres + FakeR2 fake), but the pure math heart of `thermal.py` is only reached through HTTP, which makes failure messages noisier and inflates run cost. No smelly mocking observed.

**High-priority gaps**:

1. **Thermal multi-segment math is unexecuted.** Both `_calculate_parallel_path_r_value` (`thermal.py:130-141`) and `_calculate_isothermal_planes_r_value` (`thermal.py:163-169`) currently only exercise their single-segment fast paths. This is the entire reason both ASHRAE methods exist. Add a stud+cavity fixture and assert PH-average against a hand calc.
2. **`thermal.thermal_input_hash` semantics** — only length is asserted (line 65). Need: identical inputs → identical hash; conductivity change → different hash; thickness change → different hash; project-material *name* change → **same hash**.
3. **`invalid_geometry` and `broken_material_reference`** flag emission paths in `thermal_issues` (`thermal.py:225-243`) are unreached.
4. **HBJSON layer ordering** — `_layers_outside_to_inside` reversal on `last_layer_outside` (`hbjson_export.py:177-181`) has no test fixture using that orientation.
5. **HBJSON steel-stud export** — `is_a_steel_stud_cavity` / `steel_stud_spacing_mm` fields (`hbjson_export.py:105-110`) are uncovered. Q-ENV-4 (the steel-stud `R_SE=0, R_SI=0` fix from `20-envelope.md`) is **unmeasurable from the suite as it stands**. Either the implementation lives elsewhere or the doc claim is overstated — worth verifying before any certification-side use.
6. **Drift states `source_missing`, `customized`, `in_sync`** — three of five enumerated states in `drift.py:48-62` have no test.
7. **9 untested command kinds**: `update_assembly_type`, `delete_assembly`, `flip_orientation`, `flip_layers`, `add_layer`, `add_segment`, `update_segment`, `delete_segment`, `pick_project_material`. `add_layer` and `delete_segment` have non-trivial logic (target-index resolution, `last_segment` 409) that is silently uncovered.
8. **Service no-op short-circuit** (`service.py:198-209`) — trivial one-liner to add.

### 4.2 Frontend

Coverage is **broad on the main paths** (routing, paint-mode, dimension edit, drift badges, HBJSON download dirty-warning, locked viewer, phase-16 realistic-scale fixture). Notable gaps:

1. **Airtightness & Site Photos sub-tabs** documented in `20-envelope.md:516-527` and `UI_UX.md:798-829` are not exercised by `EnvelopePage.test.tsx`.
2. **Flip orientation + flip layers** — only `flip_segments` is asserted; same seam, three behaviors, one tested.
3. **Refresh-from-catalog dialog (US-ENV-11)** — drift badge render is tested, but pressing the badge → opening the dialog → choosing `take_catalog`/`use_value`/`keep_mine` → POSTing the command has **no frontend test**. This is the highest-value V2-vs-V1 differentiator per the Glossary; highest-priority frontend gap.
4. **Add Layer / Add Segment dialog flows** — backend untested too; the frontend is the only regression guard.
5. **Hand-enter material modal** — backend covered at the API; the modal field validation / default color / "Other" category default are not.
6. **Catalog material picker submission** — gating tested; the submit-and-assert command body is not asserted independently.

### 4.3 Test file structure

`EnvelopePage.test.tsx` at **1,149 lines** is hostile to incremental edits. Natural split (6 files):
1. `EnvelopePage.routing.test.tsx` (~120 lines)
2. `EnvelopePage.toolbar.test.tsx`
3. `EnvelopeCanvas.interaction.test.tsx` (~400 lines)
4. `EnvelopeHeader.rename.test.tsx`
5. `Specifications.test.tsx`
6. `EnvelopeMaterialPicker.test.tsx` + `EnvelopeExport.test.tsx`

Fixtures already live in `phase16-fixtures.ts`, so the split is mechanical.

---

## 5. Documentation Alignment

### 5.1 Significant drift

1. **`planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md` reads as live** but every H1/H2 finding is now resolved. It cites `service.py` at 1,061 lines (now 283), 100-line `isinstance` dispatch (now a 25-line table in `commands/registry.py:34-58`), and recommends a commands-file split that shipped exactly as proposed. **Add a resolution header** noting that `assembly-builder-tools/` Phases 9-11 closed the items, so a future reader doesn't chase fixed work.

2. **`context/technical-requirements/hbjson-export.md` is apertures-only**, but `backend/features/envelope/hbjson_export.py` ships a parallel, fully-tested opaque-construction contract. The export emits identifier-cleaning rules, layer ordering, hybrid-layer `divisions.cells` shape, `ref_status` + `document_refs` semantics, and assembly-name collision disambiguation — **none of which lives in any context doc**. **Highest-impact doc gap**: create `context/technical-requirements/envelope-hbjson-export.md` mirroring the apertures structure.

3. **`context/technical-requirements/api.md`** never inventories envelope endpoints. Routes in `routes.py:38-93` (`/envelope`, `/envelope/assemblies/{id}/thermal`, `/envelope/material-catalog-drift`, `/envelope/export/hbjson`, `/draft/envelope/commands`) are absent. The schemas section mentions `assembly-segment` but not the command endpoint.

4. **`assembly-builder-tools/PRD.md` is called "the product contract"** by its README (lines 24-26) but lives under `planning/archive/`. The archive location implies historical. Either rotate the contract into `context/` or update README to delegate behavior questions to `context/user-stories/20-envelope.md`.

5. **`PRD.md §6.2` document-body sketch is illustrative-only** per `20-envelope.md:113`, but the PRD never absorbed the resolved shape. Mostly fine because the story is canonical; readers hitting the PRD first will see an outdated sketch.

6. **`20-envelope.md` sub-stories still marked "Draft"** (lines 482-497) though Phase 8 / 13-16 of `assembly-builder-tools/` shipped against them. Status sweep.

7. **`Glossary "Refresh from catalog"** matches the backend behavior but does not enumerate the `action` values (`take_catalog` / `use_value` / `keep_mine`) the API requires. Minor expansion worth doing.

### 5.2 Missing topics (shipped behavior with no doc anchor)

1. **Opaque construction HBJSON export contract** (see 5.1.2 above).
2. **Envelope thermal preview contract** — `thermal.py` self-documents but no docs file describes user-facing flag vocabulary (`missing_material`, `missing_conductivity`, `invalid_geometry`, `broken_material_reference`), `is_complete` derivation, input-hash cache semantics, or the PH-average of ASHRAE Parallel-Path + Isothermal-Planes. PH product owners will need to cite this during certification reviews.
3. **Catalog drift report contract** — five states (`drifted`, `customized`, `in_sync`, `source_deactivated`, `source_missing`) and per-field shape are not described anywhere outside the code.
4. **Semantic envelope-command list** — the 24 entries in `commands/registry.py:34-58` are the API the MCP server and frontend both call. No doc lists kinds, JSON shapes, preconditions, or conflict codes.
5. **Paint-bucket / eyedropper state machine** — 4 frontend tests but no UI_UX or user-story description. US-ENV-9 just says "copy/paste".
6. **Saved-vs-draft separation for HBJSON export** — the policy is buried in `assembly-builder-tools/README.md:135-136` instead of a context doc.

---

## 6. Recommended Sequencing

If we want to ship cleanly into the next product phase, this is the order I'd suggest:

**Batch A — Real bugs and trivial cleanups (half a day):**
- Fix `rename_assembly` uniqueness (`commands/assemblies.py:45-50`) + regression test.
- Fix `catalogPickerOpen` effect deps (`EnvelopePage.tsx:143-145`).
- Delete dead `envelopeShellNotice` (`page-helpers.ts:25-37`).
- Stale `AssemblyThermalStatus` docstring (`models.py:29`).
- `assembly-builder-foundation-review.md` resolution header.
- `20-envelope.md` "Draft" → "Shipped" status sweep.

**Batch B — Test coverage (~1-2 days):**
- Thermal multi-segment fixture (stud+cavity, hand-calc assertion).
- `thermal_input_hash` semantics (4 assertions).
- 9 untested command kinds — at least one happy-path test each, with `add_layer`/`delete_segment`/`flip_orientation`/`flip_layers` prioritized.
- Drift states `source_missing`, `customized`, `in_sync`.
- HBJSON `last_layer_outside` ordering test.
- **Verify or remove**: steel-stud `R_SE=0, R_SI=0` doc claim (Q-ENV-4).
- Frontend: refresh-from-catalog dialog flow (highest-value UI gap).

**Batch C — Refactors (1-2 days, optional but worthwhile before next feature):**
- Extract `usePaintMode` hook from `EnvelopePage`.
- Extract `useEnvelopeDialogs` hook.
- Extract `useFrozenUnitOptions` + `parseMaterialNumbers` to deduplicate `ProjectMaterialEditor` ↔ `MaterialDriftDialog`.
- Migrate `LayerThicknessEditor` to `useLengthDraft`.
- Bundle `AssemblyCanvasToolbarActions` to flatten prop fan-out.
- Split `EnvelopePage.test.tsx` along the 6 feature seams.

**Batch D — Documentation (1 day):**
- New `context/technical-requirements/envelope-hbjson-export.md` mirroring the apertures contract (highest-impact).
- Envelope thermal preview contract doc.
- Catalog drift report contract doc.
- Envelope-command catalog (kinds + preconditions + conflict codes).
- Add envelope endpoints to `api.md`.
- Resolve PRD §6.2 illustrative-vs-canonical pointer.

Batches A and B are unambiguously worth doing. Batch C is judgment-call territory — none of it is wrong as-is, but the page-level extractions get easier the sooner they happen, before more state is added on top. Batch D is the single biggest lever for future-Claude / future-Ed legibility and onboarding.

---

## 7. What's Working (don't break it)

- The semantic command boundary, shared by browser and MCP, is genuinely a multi-quarter architectural win. Every refactor in this doc must preserve it.
- ETag + draft/version separation in `service.py`.
- The functional immutable update pattern in `ops.py`.
- The SVG-canvas / DOM-overlay split.
- The `EnvelopeCommand` discriminated union as the typed contract.
- `useLengthDraft`'s mid-edit unit freeze (and the willingness to document why).
- The targeted query-invalidation map.
- The `@size-exception` annotation discipline — every annotation cites a specific review.
- Pydantic v2 hygiene.
- Test layer choice (route + Postgres) is correct for this kind of feature.

The bones are good. The work above is mostly **closing the gaps that were always going to surface** as the feature stabilised.

---

*End of review.*
