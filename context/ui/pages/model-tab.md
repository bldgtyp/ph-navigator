> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.9 Model tab (`/projects/{id}/model`)

**Purpose:** Upload HBJSON exports and view them as an interactive 3D model.
A shipped production surface (`features/model_viewer/`, `ModelTab.tsx`).

## Layout — quadrant overlay over a full-bleed canvas

The viewer is a single full-bleed WebGL canvas (`ViewerCanvas`, mounted from
`ModelViewerStage`) with floating controls pinned to the four corners. Nothing
scrolls; the canvas fills the tab. When no file is present, `ModelEmptyState`
takes the surface instead (with an upload affordance for editors).

- **Top-left — file chip** (`FileChip`): the active HBJSON file name; opens a
  popover to switch between the project's uploaded files, upload a new one
  (editors), or delete one. The active file id is URL state (`?file=`).
- **Top-center — lens bar** (`LensBar`) + theme menu (`ThemeMenu`): switches
  the active "lens" (view mode — building, and others gated by
  `lensAvailability` for the loaded model, e.g. site-sun). Lens digits `1..n`
  and the theme are URL state (`&lens=`, `&theme=`); lens + theme are the
  shareable viewer state.
- **Bottom-left — legend card** (`LegendCard`): the color legend for the
  active lens, with click-to-filter; a load summary line reports what was
  parsed.
- **Bottom-right — camera cluster** (`CameraCluster`) + measure toggle:
  fit / home camera moves and the two-point measure tool.
- **Right — inspector** (`InspectorPanel` / `ElementInspectorPanel`): slides
  in when an element is selected, showing its metadata and (for opaque
  constructions) the layered assembly. Selection styling uses the brand
  `--highlight` token family.

Selection and camera state live in the Zustand `store.ts`. Geometry is built
by `loaders/` (`building.ts` → a per-lens `BatchedMesh` substrate; see the
project memory note) and disposed on file/unmount.

## Interaction (keyboard, on the canvas)

`m` toggles measure, `f` fits, `h` homes, digits pick a lens, `⌘/Ctrl-C`
copies the selected element's identifier. `Esc` cascades: exit measure →
clear selection → clear legend filter → collapse the sun-study bar. Viewer
hotkeys are suppressed while a modal (`.modal-backdrop`) is open or a
text input holds focus.

## Site-sun lens

When the `site-sun` lens is active and the project has a location, a
`SunStudyBar` scrubber appears; without a location, an inline hint prompts the
user to set the project location (Climate tab, §2.8b).

## Access

`project.access_mode === "editor"` enables upload/delete; viewers get
read-only viewing with no file mutations.

---

**Provenance.** The accepted feature UI spec that this surface was built from
lives (archived) at
`planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md` and `PRD.md` §4
(decisions `decisions.md` D-02..D-14). The narrative above reflects the
shipped `features/model_viewer/` code, which is authoritative.
