---
DATE: 2026-07-18
TIME: 16:10
STATUS: Deferred (v1.1 candidate — moved from planning/features/ 2026-07-18 per Ed)
AUTHOR: Ed May (with Claude)
SCOPE: Execution state for contributor-auth
RELATED: README.md, PRD.md, research.md, planning/archive/dated/2026-07-19/documentation-tab/STATUS.md
---

# Contributor auth — STATUS

**State:** Deferred — v1.1 candidate (Ed, 2026-07-18). site-photos v1 ships
on the current editor/viewer model and does not depend on this. Research is
complete and current (`research.md`): auth/access code survey + Cloudflare
Access vs alternatives evaluation, so design can resume without re-surveying.

**Thread to pull when resumed:** CompanyCam Guest Access (research §B) —
email-verified, project-scoped, no-account guest uploads; the closest
industry precedent for the target persona and Ed's flagged starting point.

## Next step (when resumed)

Settle PRD §D3 (where contributor writes land — leaning B, evidence inbox)
and §D1 (login mechanism — recommended in-app magic link over Cloudflare
Access) with Ed. Those two decisions gate everything else.

## Decisions pending

- D1 login mechanism (rec: in-app magic link; Cloudflare Access evaluated
  and disfavored — see research §B).
- D2 authorization shape (rec: project-scoped `evidence.contribute` grant +
  scoped-grant resolution).
- D3 write-landing model (A micro-saves / **B inbox — leaning** / C
  de-version evidence).
- D4 invite/management surface (rec: Project Settings "Team" section).

## Blockers

None external. Self-imposed: do not start phases until site-photos v1
scope is agreed, so the two features don't co-design in circles.
