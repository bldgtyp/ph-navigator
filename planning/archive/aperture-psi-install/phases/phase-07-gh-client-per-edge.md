# Phase 07 — GH client per-edge fidelity (honeybee_grasshopper_ph_plus)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started — CROSS-REPO: work happens in
         ~/Dropbox/bldgtyp-00/00_PH_Tools/honeybee_grasshopper_ph_plus,
         following THAT repo's conventions (IronPython 2.7-compatible code,
         its own test layout). This doc is the handoff spec.
AUTHOR:  Ed + Claude
SCOPE:   Parse the route-3 `installs` block; apply psi-install per-edge after
         frame-element dedup; keep graceful fallback for old servers.
RELATED: ../decisions.md (D-5, D-10), ../research.md §4.2, phase-02 (the contract)
```

Precondition: PHN phase 02 deployed to whichever server the GH user targets
(dev or prod). Old-server payloads (no `installs` block) must keep working.

## 1. The problem being fixed (recap)

`v0/window_types_get.py` dedupes `PhWindowFrameElement` by frame-type name
(`create_new_hbph_frame_elements`, `:93-94,:107`): every edge using frame
product "X" shares ONE element instance, hence one `psi_install`. Route 3
now sends true per-edge effective values in `elements[n].installs.{side}`;
the shared-instance model cannot hold them.

## 2. Schema change (`v1/window_types_schema.py`)

- New `InstallData` class: `install_type_id`, `name`,
  `psi_install_w_mk` (float, null-safe via `_as_float`), `source` (str).
- `ElementData` gains `installs` — a 4-sided container parallel to
  `FramesData` (`:260-279`): `get_install_by_side(side)`. Missing/absent
  block → `None` (old server).
- Keep the existing `FrameType.psi_install_w_mk` 0.04 fallback intact for
  old servers, but note in the docstring that new servers always send a
  real number (uniform project default) — the fallback is now effectively
  dead against current PHN.

## 3. Build change (`v0/window_types_get.py` — or fork into v1 per the repo's
established v0-frozen convention; check `.index.md` guidance there)

In `create_new_hbph_frames` (`:112-133`), after the four
`setattr(hbph_frame, side, frame_element)` calls:

```python
for side in ["left", "right", "top", "bottom"]:
    install = element.installs and element.installs.get_install_by_side(side)
    if install is not None:
        shared = getattr(hbph_frame, side)
        edge_el = shared.duplicate()           # break the name-dedup share
        edge_el.psi_install = install.psi_install_w_mk
        setattr(hbph_frame, side, edge_el)
```

- Duplicate ONLY when an `installs` entry exists for that side — payloads
  from old servers keep the shared-element behavior byte-for-byte.
- Interior/mulled sides arrive as `psi_install_w_mk: 0.0, source: "mull"`
  and are applied like any other value (this is what finally makes mulled
  units correct in Rhino → HBJSON → WUFI without manual GH zeroing).
- `display_name`/identifier of duplicated elements: suffix with the side or
  install-type name so PHX dedup downstream doesn't silently re-merge
  distinct psi variants (check `PHX _frame_dedup_key` caveat —
  research.md §3.6 item 6 — and the repo's naming conventions).

## 4. Verification

- Unit tests in that repo's test layout: old-server payload (no installs
  block) → identical objects to today; new-server payload with mixed
  assigned/default/mull → per-edge `psi_install` values land, shared
  elements only where no install entry.
- Live check against the PHN dev server AGENT-BROWSER fixture (route 3),
  then against project 2524 once its document carries real assignments:
  the original 196-null regression case must show real numbers end-to-end
  (GH → HBJSON `psi_install` per edge).
- Confirm a WUFI-XML export from PHX carries distinct `Frame_Psi_*` values
  for a mulled fixture (0 on the shared edge).

## 5. Cleanup

- Update `.../ph_navigator/.index.md` and the archived plan pointer
  (`planning/archive/ph-navigator-v1/03-get-apertures.md`) per that repo's
  docs conventions.
- Do NOT remove the 0.04 fallback in this phase — schedule its removal only
  after all servers Ed uses emit the new contract.
