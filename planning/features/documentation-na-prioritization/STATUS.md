---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of Documentation N/A prioritization
RELATED:
  - planning/features/documentation-na-prioritization/PRD.md
---

# STATUS — Documentation N/A Prioritization

**State:** `Active` planning; no code written.

## Next step

Add red `DocumentationSummaryView` tests for a mixed Assembly group and a group
containing only fully N/A records under three identities: editor, authenticated
read-only/locked, and anonymous. Confirm the exact auth-state seam before using
it in the component.

## Verification

- [ ] Named fully-N/A predicate unit tests.
- [ ] Stable partition preserves relative order.
- [ ] Logged-in collapsed bottom section and count.
- [ ] Attention filter suppresses the section.
- [ ] Anonymous DOM contains no N/A record labels or empty group.
- [ ] Rollup counts unchanged.
- [ ] Record-detail and Directions modal regressions remain green.
- [ ] `make agent-browser-ready` and signed-in/signed-out Documentation smoke.
- [ ] Focused frontend gate and docs pass.

## Coordination

`planning/refactor/overview-documentation-progress/` has implementation on a
separate branch as of 2026-08-16. This packet primarily touches the Documentation
page, but merge/rebase must preserve its shared `StatusAxisRollup` work.

## Blockers

None, once the existing auth/session discriminator is identified.
