---
DATE: 2026-09-08
TIME: 22:01 EDT
STATUS: In review
AUTHOR: Codex for Claude
SCOPE: Additive desktop material catalog reads
RELATED: context/mcp.md, context/technical-requirements/api.md, ph-navigator-sketchup shared-material-library phase 04
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/90
---

# Desktop catalog read

Read-only web support for **PH-Navigator for SketchUp** connecting to the
shared material library through a browser-approved device grant.

Read [STATUS.md](STATUS.md), then [PRD.md](PRD.md). This small packet has one
implementation slice: scope/migration, bearer reads, approval copy, and tests.
Branch: `feature/desktop-catalog-read`.

Consumer/spec: sibling repository `ph-navigator-sketchup`,
`planning/features/shared-material-library/phases/phase-04-connection.md`,
**Web repository** section; consumer issue
[#44](https://github.com/bldgtyp/ph-navigator-sketchup/issues/44).
Extension transport, Keychain, sidebar, and host validation belong to that
consumer packet. Web issue: [#90](https://github.com/bldgtyp/ph-navigator/issues/90).

Canonical API contract: [desktop catalog reads](../../../context/technical-requirements/api.md#desktop-catalog-reads).
No commit, push, or deployment is part of this handoff. Deployment is Ed's decision.
