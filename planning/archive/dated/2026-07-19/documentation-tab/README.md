---
DATE: 2026-07-18
TIME: 16:10
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Archived router for the documentation-tab feature folder
RELATED: planning/features_v1.1/contributor-auth/, context/user-stories/20-envelope.md (US-ENV-15),
         context/ui/pages/envelope-tab.md §2.7.5, context/ui/pages/status-tab.md,
         context/technical-requirements/attachments.md, context/UI_UX.md §1.8
---

# Documentation tab (formerly "site-photos")

Extend the site-photo affordance (today: envelope assembly segments only) to
all Equipment records, Apertures, and Thermal Bridges, and add a top-level
**Documentation** tab (`/projects/{id}/documentation`): a whole-project,
contractor- and certifier-facing surface showing every record's three
documentation axes (specification / datasheet / photo), with "what photos
are needed and how to take them" directions and a done/missing rollup.
Renamed from `site-photos` on 2026-07-18 when the page's scope grew beyond
photos (decisions.md sessions 2–3).

## Read order

1. `STATUS.md` — current state and the active phase.
2. `PRD.md` — settled product contract (design finalized 2026-07-18).
   `assets/wireframe.html` (v2.1) is the visual contract — open it in a
   browser alongside the PRD.
3. `PLAN.md` — phase sequence + standing rules; then the active phase file
   under `phases/`.
4. `research.md` — verified current-state code survey (file paths, reuse
   map, gap analysis). `decisions.md` — full decision log with rationale.

## Phase map

| Phase | File | Scope |
|---|---|---|
| 0 | `../heat-pump-display-name/phases/phase-01-survey-and-align.md` | HP Display Name prerequisite |
| 1 | `phases/phase-01-backend-schema-registry.md` | Schema + registry + rename |
| 2 | `phases/phase-02-backend-heic-summary.md` | HEIC + summary endpoints |
| 3 | `phases/phase-03-frontend-photo-columns.md` | Proximate photo columns |
| 4 | `phases/phase-04-documentation-page-viewer.md` | Page, viewer-first |
| 5 | `phases/phase-05-editor-affordances-directions.md` | Writes + directions |
| 6 | `phases/phase-06-verification-docs.md` | E2E verification + docs pass |

## Relationship to other work

- **US-ENV-15** (`context/user-stories/20-envelope.md`) is the drafted-but-
  unbuilt envelope Site Photos sub-tab. This feature supersedes-or-absorbs
  it — see PRD §D1. Do not implement US-ENV-15 independently while this
  design is open.
- **User-Story 2 (team-member uploads)** is split into its own feature,
  **deferred to v1.1** (Ed, 2026-07-18):
  `planning/features_v1.1/contributor-auth/`. Nothing in *this* feature
  may depend on contributor-auth landing; the contractor-facing page (Story
  3) is anonymous read-only.
- The Materials sub-tab (`/envelope/materials`) and its per-segment photo
  flow are the reuse template throughout (shared `AttachmentCell`,
  attachment registry, evidence grammar §1.8).
