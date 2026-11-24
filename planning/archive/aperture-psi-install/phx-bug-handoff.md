# Handoff — psi-install bugs found in PHX / honeybee_ph (2026-08-03)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Handoff — for the PHX-agent; NOT part of the aperture-psi-install
         feature. Ed delivers this file; fixes happen in the PHX /
         honeybee_ph / honeybee_grasshopper_ph repos with their own tests.
AUTHOR:  Ed + Claude (found during the 2026-08-03 psi-install code survey)
SCOPE:   Self-contained bug list with locations, symptoms, and suggested fixes.
RELATED: ../aperture-psi-install/research.md §3.6 (fuller context)
```

Repos under `~/Dropbox/bldgtyp-00/00_PH_Tools/`. Verify each against current
source before fixing — line numbers are as of 2026-08-03.

## P1 — wrong data written/read

1. **WUFI-XML import: bottom frame is a copy of top.**
   `PHX/PHX/from_WUFI_XML/phx_schemas.py:284-290` — `frame_data_bottom`
   reads `_t.Frame_Width_Top`, `_t.Frame_U_Top`, `_t.Glazing_Psi_Top`,
   `_t.Frame_Psi_Top` instead of the `*_Bottom` fields. Every WUFI-XML
   round-trip silently replaces the bottom frame with the top one.
   Fix: point the four reads at `*_Bottom`. Also note the `or`-chain
   fallbacks (`:265-289`) conflate an explicit `0.0` with "unset", making a
   real 0 psi on right/top/bottom inherit the previous side's value —
   consider `if x is None` semantics while in there.

2. **PHPP 10.x localizations: psi_i_bottom/psi_i_top swapped between SI and
   IP variants.** Compare `PHX/PHX/PHPP/phpp_localization/EN_10_6.json` vs
   `EN_10_6IP.json` (Components `frames` section ~:594-608 AND Windows
   `window_rows` section ~:725-739); same for `EN_10_4A` vs `EN_10_4IP`.
   10_6: bottom=KB/top=KA vs 10_6IP: bottom=KA/top=KB (Windows: AQ/AP vs
   AP/AQ). One variant is wrong — check against the actual PHPP workbooks.

3. **Windows sheet psi-install written with no unit conversion.**
   `PHX/PHX/PHPP/phpp_model/windows_rows.py:90-99` — raw W/m·K numbers are
   written even for IP PHPP files (localization declares BTU/HR-FT-F). The
   Components-sheet writer converts (`component_frame.py`,
   `_build_averaged_psi_items(..., "W/MK", target_unit)`); the Windows-sheet
   writer must do the same.

## P2 — silent fidelity loss

4. **Psi-install column-averaging is always unweighted.**
   `PHX/PHX/PHPP/phpp_model/component_frame.py:179-182` fetches weights by
   `psi_i_*` keys, but `phpp_app.py:322-364`
   (`_collect_window_psi_g_lengths`) only produces `psi_g_*` keys → every
   weight falls back to 1.0. Either emit `psi_i_*` length weights (edge
   lengths are available) or delete the dead weighting path.

5. **METr `lrtb*` arrays are filled T,R,B,L.**
   `PHX/PHX/to_METr_JSON/metr_schemas.py:219-242` — keys named `lrtb`
   (left,right,top,bottom) but all four arrays (`lrtbFrW`, `lrtbFrU`,
   `lrtbGlPsi`, `lrtbFrPsi`) are populated top,right,bottom,left. Check the
   METr consumer's expectation; fix the order or rename the key, and add a
   round-trip test.

6. **PPP frame dedup ignores psi values.**
   `PHX/PHX/to_PPP/ppp_schemas.py:663-672` — `_frame_dedup_key` includes
   name/width/U but not `psi_install`/`psi_glazing`; frame types differing
   only in psi collapse into one PPP entry. Add the psi fields to the key.

## P3 — hygiene

7. **`PhWindowFrameElement.from_dict` hard-requires `psi_install`.**
   `honeybee_ph/honeybee_energy_ph/construction/window.py:61` uses
   `_input_dict["psi_install"]` (KeyError on legacy HBJSON) while newer
   fields use `.get(..., default)` (`:63-64`). Use `.get("psi_install", 0.04)`.

8. **GH per-aperture psi setter mutates shared constructions.**
   `honeybee_grasshopper_ph/honeybee_ph_rhino/gh_compo_io/apertures/win_set_psi_install_values.py:186-200`
   — `ap.duplicate()` keeps a shared construction reference; writing
   `ph_frame` psi values leaks to every aperture using that construction.
   Duplicate the construction (see the sibling
   `win_set_hb_const_psi_install_values.py:98-121` which does it right).
   Bonus in the same pair of files: the DataTree index fallback catches
   `ValueError`, but IronPython .NET list indexing raises
   `ArgumentOutOfRangeException`/`IndexError` — the "1 value → all edges"
   fallback may never fire; and `...set_hb_const_psi_install_values` is
   missing its `_component_info_.py` registration entry.

## Context worth knowing while fixing

- honeybee_ph default psi_install = 0.04 W/m·K; PHX default = 0.0 — a plain
  HB `WindowConstruction` with no PH frame lands at 0.0 with no warning
  (`PHX/from_HBJSON/create_assemblies.py:406`). Not a bug per se; know it
  before "fixing" defaults.
- `windows_rows.py:89` carries a TODO noting PHPP's Windows-sheet columns
  are an install-*situation* selector, not a psi cell — a real modeling
  question for Ed, not a mechanical fix; leave unless directed.
- Edge iteration order is T,R,B,L in honeybee_ph (`window.py:127`) but
  L,R,T,B in PHX PPP/PHPP writers — never move index-driven code between
  them.
