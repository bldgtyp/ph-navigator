---
DATE: 2026-08-01
TIME: 08:41 EDT
STATUS: Ready — Phase 01 user-scoped tokens implemented
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Backend + web UI — device-authorization flow for agent credentials.
RELATED: ../PRD.md §3, ../decisions.md §D-3, ./phase-01-user-scoped-tokens.md
---

# Phase 02 — Device-flow login

## Goal

An agent with no credential obtains a user-scoped token via one browser click
by Ed. No secret transits a human's clipboard or keyboard.

## Flow (OAuth device-grant shaped, minimal)

1. `POST /api/v1/agent-tokens/device` (unauthenticated) →
   `{device_code, user_code, verification_url, interval, expires_in}`.
   Request carries requested scopes + a machine/agent label.
2. Approval page `www.ph-nav.com/approve-agent?code=XXXX-XXXX`
   (session-gated): shows user code, scopes, label; **Approve** / **Deny**.
3. `POST /api/v1/agent-tokens/device/poll` with `device_code` →
   `authorization_pending` | `slow_down` | `denied` | `expired` | the
   plaintext token exactly once.
4. Agent writes `~/.config/phn/credentials.json`, mode 600:
   `{"phn_api": "...", "token": "phn_mcp_...", "label": "...", "issued": "..."}`.

## Hardening

Device codes ≤15 min, single redemption, hashed at rest; poll rate limiting;
approval binds to the approving user's account; audit log entry on
approve/deny; the resulting token row is a normal Phase-01 user token
(revocable from "My agent tokens").

## Tasks

1. Backend: device-code table + three endpoints + expiry sweep.
2. Frontend: approval page (session-gated), wired into the account area.
3. Client side: a small `phn-login` script/entry (lands in the Phase-04
   plugin and Phase-05 Codex config; here just a `uv run`-able reference
   implementation + smoke test).
4. Tests: happy path, deny, expiry, double-redemption, poll flood.
5. Docs: `context/mcp.md` token-issuance section gains the device flow.

## Done when

Local stack: from a shell with no credential, the reference script prints the
approval URL, `codex@example.com` approves in the browser, the script writes
`credentials.json`, and an MCP call with that token succeeds — with zero
copy-paste.
