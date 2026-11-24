# Upstream alignment: honeybee-ph / PHX aperture-psi-install refactor

**Status:** Upstream SHIPPED (2026-08-12) — honeybee-ph v1.33.33 (PR #87), PHX v1.56.73 (PR #80),
honeybee_grasshopper_ph PR #60 merged (Ed's canvas/.ghuser step pending). This doc maps the
upstream design to this packet's phase 07 (GH client per-edge consumption). No PHN backend/frontend
changes needed.

**Upstream docs (same slug in each repo):**
- `honeybee_ph/planning/archive/aperture-psi-install/` — **primary** (complete, archived): data model + resolver
- `PHX/planning/archive/aperture-psi-install/` — (complete, archived) PHPP per-row write; WUFI/METr variant synthesis
- `honeybee_grasshopper_ph/planning/refactor/aperture-psi-install.md` — components; deletes the
  construction-duplication mechanism (their bug #59)

## What upstream built

Exactly the model this packet's D-1/D-2 decisions anticipated, one level down the chain:

- `PhApertureInstallType` (honeybee_energy_ph): named object — display_name, `psi_install`
  (W/mK), free-text `source`. The HBJSON twin of this repo's `aperture_install_types` rows.
- Four optional per-edge slots (t/r/b/l) on `AperturePhProperties`; `None` = inherit the
  window construction's frame-element value. Serialized inline (full object per edge), no
  model-level registry.
- One resolver in `honeybee_ph_utils` feeding ISO 10077-1 and PHX.
- PHX: PHPP gets per-row resolved Ψ-install (native support); WUFI/METr get deterministic,
  content-keyed window-type variants synthesized at export time.

## Phase-07 mapping (GH client, `honeybee_grasshopper_ph_plus`)

Route-3 `installs` block (`backend/features/gh_api/aperture_types_export.py`, `_install()`)
maps 1:1 — the client should build one `PhApertureInstallType` per distinct library row and
assign per edge:

| Route-3 field | honeybee-ph target |
|---|---|
| `install_type_id` (`apit_*`) | `PhApertureInstallType.identifier` (verbatim — preserves round-trip identity) |
| `name` | `display_name` |
| `psi_install_w_mk` | `psi_install` |
| `source` (`assigned`/`default`/`mull` + type source) | `source` (free text) |

- **Mulled interior edges**: arrive as `psi_install_w_mk = 0.0, source = "mull"` → assign a
  zero-Ψ install type to that edge. honeybee-ph deliberately has no "mulled" concept
  (upstream primary doc §2); edge adjacency stays this repo's responsibility. Unchanged: D-3.
- **Default-inherited edges** (`source = "default"`): two options — assign the `apit_default`
  type explicitly (fully explicit HBJSON), or leave the slot `None` and set the construction
  frame default from `default_install_psi_w_mk`. Recommend the former: PHN is the authority on
  resolution; exporting resolved assignments keeps one resolver semantics per system.
- **The legacy uniform `frames.{side}.frame_type.psi_install_w_mk` field** (route-3
  `:170-187`): retained for old clients; once the phase-07 client consumes `installs`, it stops
  reading the legacy field. The dedup hazard it was designed around (shared
  `PhWindowFrameElement` by frame name) disappears — psi-install no longer needs to vary
  frame elements at all.

## What this unblocks

The chain PRD §6 deferred now has a defined landing zone end-to-end:
PHN Install Types → GH client → `AperturePhProperties` slots → PHX → per-row PHPP /
variant-synthesized WUFI+METr. No per-aperture construction duplication anywhere.

Sequencing: honeybee_ph release → PHX release → GH components → phase 07 here.
