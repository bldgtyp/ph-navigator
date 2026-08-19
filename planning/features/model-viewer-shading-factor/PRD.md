---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — behavior and data contract ready
AUTHOR: Ed May / Codex
SCOPE: Product contract for seasonal shading-factor coloring
RELATED:
  - planning/features/model-viewer-shading-factor/README.md
  - planning/features/model-viewer-shading-factor/PLAN.md
---

# PRD — Model Viewer Shading Factor

## 1. Goal

On the 3D Model page's Building lens, add a **Shading Factor** color mode next
to Window Construction. Every window is colored from its saved HBJSON factor,
with a **Summer / Winter** sub-option.

The mode is diagnostic: users should immediately see which apertures receive
more or less solar transmission after shading and find missing factors.

## 2. Data contract

Extend the extracted Aperture model with nullable PH properties:

```text
properties.ph.summer_shading_factor: float | null
properties.ph.winter_shading_factor: float | null
```

- Legacy artifacts may omit `properties.ph` entirely. The backend field is
  optional/nullable with a `None` default; the frontend type is
  `ph?: AperturePhProperties | null`, and every read uses optional chaining.
  Newly extracted artifacts serialize the two factor keys as numbers or null.
- Read from `hb_aperture.properties.ph` during extraction.
- Accept only finite values in `[0, 1]`; invalid or out-of-range values become
  null. Do not silently clamp bad data. An absent PH object or absent factor is
  ordinary Missing data and does not warn.
- Aggregate invalid-value warnings per artifact and field: at most one Summer
  warning and one Winter warning, each reporting the total invalid count, the
  first 20 aperture identifiers, and an omitted-identifier count when needed.
- Preserve factors as numbers, not formatted strings.
- Thread them through backend schema → `/model_data` JSON → TypeScript
  `ApertureModelData` → `ApertureMeshFaceMeta`.
- No Project Document schema change: this feature reads the uploaded HBJSON
  Model artifact.

Model artifacts are immutable per uploaded file. Existing extracted artifacts
will not gain factors automatically; they must be re-extracted/re-uploaded or
processed by a separately authorized artifact-rebuild operation. Do not fake
default `0.75` in the viewer for old artifacts.

## 3. Theme and seasonal state

- Add one `ModelViewerTheme`: `shading-factor`, label **Shading Factor**, allowed
  only on the Building lens.
- Add shareable seasonal state: `season=summer|winter` in the Model URL.
- Default to `summer` when the parameter is absent/invalid.
- The season parameter only affects Shading Factor. Other themes ignore it but
  preserve a valid value so returning to the mode restores the user's choice.
- Show a shared small segmented control labelled **Season** with Summer and
  Winter directly below the theme selector while the Shading Factor theme is
  active.
- Theme/season changes repaint existing batches; they do not rebuild geometry
  or refetch the Model.

## 4. Color semantics

Use this fixed five-stop continuous scale over the physical domain `[0, 1]`:

| Factor | Color     |
| ------ | --------- |
| `0.00` | `#00224E` |
| `0.25` | `#3B496C` |
| `0.50` | `#7D7C78` |
| `0.75` | `#B9B862` |
| `1.00` | `#FDE737` |

Interpolate linearly in sRGB between the adjacent stops. This dark-blue to
yellow sequence is ordered and color-blind-safe; its fixed stops make renderer,
legend, and midpoint tests deterministic.

Semantics:

- `0.00` = fully shaded / no solar transmission after shading;
- `1.00` = unshaded / no shading reduction;
- the same numeric value always has the same color across projects, files, and
  seasons;
- do not normalize to the current Model's minimum/maximum;
- null = `#9CA3AF` neutral-grey **Missing** bucket, used identically by the
  renderer and legend and visibly distinct from valid values.

Only `apertureMeshFace` objects receive factor colors. Opaque surfaces retain
the Building lens's neutral shaded material so window comparison stays legible.

## 5. Legend and inspection

- Replace the existing discrete-row legend shape for this theme with a
  continuous gradient legend titled `Summer shading factor` or
  `Winter shading factor`.
- Show ticks at `0`, `0.25`, `0.50`, `0.75`, and `1.00`, plus the semantic
  endpoint labels Fully shaded and Unshaded.
- Show a separate Missing swatch/count when null values exist.
- Continuous gradient ticks are not clickable legend filters. The Missing row
  may remain non-filtering for consistency; filtering by numeric range is out of
  scope.
- The element inspector exposes both Summer and Winter values for a selected
  aperture to three decimals (`0.000`–`1.000`), or **Missing**, so the color can
  be audited without switching twice.

## 6. Acceptance

- Building theme menu includes Shading Factor; other lenses do not.
- Summer/Winter segmented choice appears only for the active theme and survives
  a shareable URL round-trip.
- Known factors `0`, `0.25`, `0.5`, `0.75`, `1` map deterministically across the
  fixed scale.
- Switching season recolors windows without geometry rebuild or network fetch.
- Missing/invalid factors render grey, count as Missing, and never masquerade as
  0.75.
- Opaque Building surfaces remain neutral and visible.
- Inspector shows both source values.
- Batch/draw-call behavior remains on the existing `LensBatch`/`BatchedLens`
  substrate and does not regress the established viewer performance gate.
- A newly extracted HBJSON fixture carries factors end to end.
- An old artifact without PH factor fields loads safely and shows Missing.

## 7. Non-goals

- Computing geometric shading factors in PHN.
- Editing factors from the 3D viewer.
- Monthly shading factors or radiation simulation.
- Automatically rebuilding production Model artifacts.
- Numeric range filtering or per-project auto-normalization.
