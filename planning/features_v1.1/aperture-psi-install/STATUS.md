# STATUS — aperture-psi-install

**State:** 🟡 Researched + design drafted (2026-08-03) — **blocked on Ed's UX
decision** (PRD §7). No implementation started; not yet phased.

**What exists:**
- `research.md` — full cross-package code survey (honeybee_ph, PHX writers,
  both GH plugins, PHN), program defaults verified against the phius-rules
  corpus, upstream bug list.
- `PRD.md` — draft design: `aperture_install_types` project table +
  per-element-edge assignment + derived mulled-edge zeros + Installs-modal UX
  proposal + route-3 contract + GH-client sequencing note.

**Origin (unchanged):** `HBPH+ - PH-Nav Get Apertures` (route 3) returned
`psi_install_w_mk: null` on ~196 frames of project 2524; the GH client falls
back to a fabricated 0.04 W/mK.

## Decisions — resolved by research (2026-08-03)

- [x] **Granularity: per-edge** (per aperture-element side). Downstream is
      per-edge end-to-end; `ProjectFrame` dedup makes per-frame storage
      unable to express head-vs-sill. (research.md §2–§5)
- [x] **Data source: shared install-type library** (project table), not
      hand-entered numbers per edge. Matches both personas and the proven
      AirTable precedent. (PRD §1, research.md §4.2)
- [x] **Default policy: PHN resolves and emits effective values** (program-
      aware Default row; interior mull edges derived Ψ=0). Route 3 stops
      emitting null; the GH 0.04 fallback becomes dead code. (PRD §3–§4)
- [x] **Verified program defaults:** Phius 0.030 IP ≈ 0.052 W/m·K (NOT 0.04);
      0.020/0.015 IP mid-wall tiers; 0 at mulled sides (§1.4.4.6). 0.04 W/mK
      is the PHI-side convention. (research.md §1)

## Decisions — awaiting Ed (PRD §7)

- [ ] UX: Installs **modal with key view** (recommended) vs table-matrix vs
      canvas mode.
- [ ] Sub-tab name ("Installs"?) as 5th Apertures sub-tab.
- [ ] Default-row semantics (editable? program-change behavior?).
- [ ] Void-adjacent edges: perimeter or separate category.
- [ ] Documentation-page evidence axis: extend axes (recommended) / reuse
      datasheet field / Status-only.
- [ ] Delete-blocking (recommended) vs clear-to-default for referenced types.

## Then (once decided)

- [ ] Phase plan: schema v9→v10 (table + `ApertureElementInstalls` + seeds),
      commands, route-3 emission, Installs tab, modal, Status/Documentation
      wiring. (Checklist skeleton in research.md §5.3.)
- [ ] Coordinated `honeybee_grasshopper_ph_plus` change: apply psi-install
      per-edge after frame-element dedup. **Must land before PHN emits
      varying per-edge values** (uniform-default emission is safe first).
- [ ] File upstream PHX/honeybee_ph bugs from research.md §3.6 in their repos.
