---
DATE: 2026-05-11
UPDATED: 2026-07-18
STATUS: Redirect. The MVP user-story bodies are archived; live contracts
        live in technical-requirements/ and ui/pages/.
RELATED: context/PRD.md, context/UI_UX.md,
         context/technical-requirements/data-table.md
---

# PH-Navigator — User Stories (archived)

The user-story bodies were **authoring history** for the MVP build, which
has shipped and is live at `www.ph-nav.com`/`api.ph-nav.com`. On
2026-07-18 the ~10k-line story cluster was moved out of canonical
`context/` to **`planning/archive/user-stories/`** (grep by `US-` id or
`Q-` question id). The durable contracts those stories produced now live
in their own canonical homes — read those, not the archived narrative:

| For… | Read (live contract) |
|---|---|
| Any project page/screen | `context/ui/pages/<page>.md` + `context/UI_UX.md` |
| Shared DataTable behavior | `context/technical-requirements/data-table.md` |
| Data model / save-versioning | `context/technical-requirements/data-model.md`, `save-versioning.md` |
| API / MCP surface | `context/technical-requirements/api.md`, `context/mcp.md` |
| Apertures / Envelope / Viewer | the matching `ui/pages/*` + `technical-requirements/*` files |
| Active/planned work | `planning/STATUS.md` |

## Still-open questions carried forward

Everything in the archived `90-open-questions.md` is resolved except these
two aperture items (verify against code before acting on either):

- **Q-APT-3 — Default frame/glazing on aperture-element create.** Lean: `null`
  + Save-time validation (explicit pick required); not re-verified against the
  shipped builder.
- **Q-APT-5 — Per-aperture-type deep-link URL.** Still open / not shipped.
  Routes are `/projects/{id}/apertures/{builder|glazings|frames}` only; the
  active aperture type is component/store state (`AperturesTab.tsx`), not a URL
  param.

The original **vertical-slice phasing plan** (Phases 0–7) is preserved in the
archived bodies and in the `planning/archive/README.md` index; it is historical
and no longer a tracker.
