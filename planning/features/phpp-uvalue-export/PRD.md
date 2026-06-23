---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Draft — behavior contract for review
AUTHOR: Ed (via Claude)
SCOPE: Behavior contract + canonical CSV layout for the PHPP U-Value export.
RELATED: README.md, decisions.md, research.md
---

# PRD — PHPP U-Value Export

## 1. User story

> As a Passive House consultant, from ENVELOPE → Assemblies I click "…" →
> **Download in PHPP format** and get a ZIP containing one CSV per assembly,
> each laid out like the PHPP **U-Values** worksheet, in whichever units
> (IP/SI) the app is currently showing, so I can paste each assembly straight
> into PHPP without retyping materials, conductivities, and thicknesses.

## 2. Entry point & trigger

- A new `AppMenuItem` "Download in PHPP format" in the Assemblies "…" menu
  (`EnvelopePage.tsx`, the `AppMenu` rendered only on the assemblies route),
  directly below "Download constructions HBJSON".
- Disabled while the export is in flight (mirror `exportMutation.isPending`).
- Like HBJSON, the export targets the **saved version**. If a draft exists
  (`source === "draft" && draft_etag`), show the same pre-export warning the
  HBJSON path uses ("…reads the last committed version, not your current
  draft… Continue with the saved version?") before doing anything else.

## 3. Output: the ZIP

- One ZIP, streamed from the backend (`application/zip`, `Content-Disposition:
  attachment`), saved via `downloadBlob`.
- ZIP name: `phpp-u-values-<IP|SI>-<versionId>.zip`.
- One CSV per assembly. CSV filename = sanitized assembly name + `.csv`
  (e.g. `W-CS (Crawlspace)` → `W-CS (Crawlspace).csv`; strip/replace
  filesystem-hostile characters `/ \ : * ? " < > |`, collapse whitespace,
  trim, cap length). De-duplicate collisions with a numeric suffix
  (`name (2).csv`), mirroring `_dedupe_path` in `assets/service.py`.
- Every assembly in the saved version produces exactly one CSV — either a
  full data CSV or an **error CSV** (§6). Never a partial CSV.

## 4. Canonical CSV layout (full worksheet block)

Decision: **full block matching the screenshots** (`decisions.md` Q4),
including the PHPP-calculated U-value + total thickness as a reference /
sanity-check. The grid is **7 columns** (A–G); G is the far-right Thickness
column. Layers are written **Exterior → Interior**, top to bottom
(`decisions.md` Q2).

```
Col:  A                                          B            C                          D            E                          F                       G
----  -----------------------------------------  -----------  -------------------------  -----------  -------------------------  ----------------------  --------------
r1    Description of building assembly                                                                                           Assembly no.
r2    <assembly name>                                                                                                            <blank>                 <blank>
r3    (blank)
r4    Orientation of building assembly (or Rsi)  0                                                                              Interior insulation?    <blank>
r5    Adjacent to (or Rse)                       0                                                                              U-value supplement [W/(m²K)]  <blank>
r6    Area section 1                             λ [W/(mK)]   Area section 2 (optional)  λ [W/(mK)]   Area section 3 (optional)  λ [W/(mK)]              Thickness [mm]
r7..  <mat sec1>                                 <λ1>         <mat sec2 | blank>         <λ2 | blank> <mat sec3 | blank>         <λ3 | blank>            <thickness_mm>
      … one row per layer, ext→int, padded with blank rows up to 8 …
rP    Percentage of sec. 1:                      <%1>         Percentage of sec. 2:      <%2 | blank> Percentage of sec. 3:      <%3 | blank>
      (blank)
      Heat transmission resistance coefficients
      Interior Rsi:                              0.00         m²K/W
      Exterior Rse:                              0.00         m²K/W
                                                                                                                                 Total thickness [cm]:   <total_cm>
                                                                                                                                 U-value [W/(m²K)]:      <u_value>
```

### Cell formatting

| Field | Source | Format | Notes |
| --- | --- | --- | --- |
| assembly name | `Assembly.name` | text | row 2, col A |
| Assembly no. | — | blank | PHPP assigns its own (`01ud`, `04ud`); leave empty (`decisions.md` open Q-D) |
| material name | `ProjectMaterial.name`; in **IP** append ` [ <in> in ]` | text | inch annotation only in IP — see §5 |
| λ (conductivity) | `ProjectMaterial.conductivity_w_mk` | 3 decimals, e.g. `3.000`, `0.036` | **W/(mK) in BOTH IP and SI** (PHPP keeps λ metric) |
| Thickness | `AssemblyLayer.thickness_mm` | integer mm, e.g. `203` | **mm in BOTH** units |
| Percentage of sec. N | segment width fractions (§7) | percent; `100%` when single section | precision: see `decisions.md` open Q-C |
| Interior Rsi / Exterior Rse | constant `0.00` | `0.00` | matches screenshots; PHN has no surface films |
| Total thickness [cm] | Σ layer thickness_mm / 10 | 1 decimal, e.g. `33.0` | reference (cm in both) |
| U-value [W/(m²K)] | `thermal.u_effective_w_m2k` | 3 decimals, e.g. `0.278` | **W/(m²K) reference**; PHN vs PHPP methods differ slightly (§8) |

> Exact column placement of the percentages row and the right-side labels
> (Assembly no., Total thickness, U-value) is **soft** until validated by a
> real PHPP copy/paste in Phase 4 — see `decisions.md` open Q-A. The 7-column
> grid above is the working assumption.

## 5. Units (IP vs SI)

- Source of truth: the live `useUnitPreference().unitSystem` ("IP" | "SI",
  default SI). Frontend passes it to the backend as `?units=IP|SI`.
- Backend stores SI only and does the (tiny) conversion for the file.
- **The only IP-specific transform the screenshots show** is the
  ` [ <in> in ]` thickness annotation appended to the material name, where
  `<in> = round(thickness_mm / 25.4, 1)` (203 mm → `8.0`). λ stays W/(mK) and
  thickness stays mm in both unit systems.
- **Open (Q-B):** confirm the annotation goes on *every* material row in IP
  (the screenshot only shows it on the concrete row — possibly because it was
  typed into that material's name rather than auto-generated). Working
  assumption: auto-append to every row in IP; none in SI.

## 6. Eligibility & error CSVs (no partial output)

An assembly is **not exportable** when any of these hold; it then gets an
error CSV whose body is a single human-readable line stating the reason
(no data rows), and it is listed in the pre-download modal (§9):

| Reason code | Condition | CSV message (draft) |
| --- | --- | --- |
| `too_many_layers` | `len(layers) > 8` | `Cannot export: <N> layers exceeds the PHPP U-Value maximum of 8 rows.` |
| `too_many_pathways` | resolved sections > 3, or split layers have incompatible width profiles | `Cannot export: assembly needs more than 3 heat-flow pathways (PHPP allows up to 3 area sections).` |
| `incomplete_materials` | any segment has no material / missing conductivity / broken material ref | `Cannot export: assembly has missing materials or conductivities.` |

This is a deliberate divergence from HBJSON's all-or-nothing 422: PHPP export
reports per assembly so one bad assembly never blocks the rest. (`decisions.md`
open Q-E records this.)

## 7. Segment → PHPP section mapping

PHN models **per-layer parallel segments** (each layer can split differently);
PHPP has **3 global "Area sections"** with one percentage split for the whole
assembly and one thickness per row. Mapping rule (`decisions.md` Q1):

1. For each layer compute its **width-fraction profile**: uniform layer =
   `(1.0)`; split layer = `(w_i / Σw)` in segment `order`.
2. All **split** layers (segment count > 1) must share one identical profile
   (same count, same fractions within tolerance, same order). That shared
   profile defines the assembly's **global section percentages**. If there are
   no split layers, there is 1 section at `100%`.
3. `num_sections = len(profile)` must be **≤ 3**. Otherwise → `too_many_pathways`.
   Inconsistent split profiles → `too_many_pathways` too.
4. Build each row (ext→int):
   - **uniform layer** → its single material + λ are broadcast into *all*
     `num_sections` columns (it spans every path).
   - **split layer** → segment `i`'s material + λ go into section column `i`.
   - thickness = `layer.thickness_mm` (shared across sections, one G cell).
5. This faithfully supports the real case of a stud line running through
   several layers (aligned splits → 2–3 sections) and errors only on the
   genuinely-unrepresentable cases. The "same stud across layers" alignment is
   **inferred from equal width-fraction profiles** (PHN has no explicit
   cross-layer segment link) — flagged in `decisions.md` open Q-F.

## 8. Reference U-value caveat

We emit the PHN construction U (`u_effective_w_m2k`, the average of ASHRAE
parallel-path and isothermal-planes, with no surface films) for the green
reference cell. With Rsi = Rse = 0 in the sheet, PHPP's recomputed U is
construction-only too, so they should be close — but PHPP's section-averaging
method is not identical, so treat the exported U as a sanity-check, not a
guarantee of an exact match.

## 9. Pre-download modal (confirm/cancel)

- Flow: click → (draft warning if needed) → call **preflight** → if any
  assembly is non-exportable, show a modal (`ModalDialog` + `DialogActions`)
  listing them and their reasons, with **Cancel** and **Download anyway**.
  - **Cancel** → abort; nothing downloads.
  - **Download anyway** → call the zip endpoint and save it (good CSVs +
    error CSVs).
- If every assembly is exportable, skip the modal and download directly.
- Preflight is a backend endpoint so eligibility logic lives in one place
  (Python) rather than being duplicated in TS (`research.md` §"architecture
  decision").

## 10. Acceptance criteria

1. Menu item appears only on the Assemblies route, disabled while exporting.
2. SI mode: ZIP with one CSV per assembly; a known all-single-segment assembly
   matches a golden CSV byte-for-byte (modulo the soft cells of §4).
3. IP mode: identical except material names carry the ` [ <in> in ]`
   annotation.
4. A 2-section assembly (one consistent split, e.g. stud/cavity through 2
   layers) renders sections 1 & 2 with correct global percentages and
   broadcasts uniform layers across both.
5. `> 8` layers, `> 3`/incompatible pathways, and incomplete-material
   assemblies each yield an error CSV with the right message and appear in the
   modal; the rest still export.
6. Cancel aborts with no download; Download-anyway saves the ZIP.
7. Draft-present warning fires before export, as in HBJSON.
8. Read-only/viewer access can still export (mirror `ProjectViewAccess` on the
   HBJSON route).
