> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements (§1), flows (§3), and the state-indicator
> cheatsheet (§4) stay in `../../UI_UX.md` — read it alongside this page.

# 2.14 Agent access (`/approve-agent`, `/account/agent-tokens`)

These signed-in, app-level pages support the production Claude/Codex device
login. They are not project-workspace tabs and never display a plaintext bearer
token.

## Approve agent

The approval screen uses a centered, width-constrained card (640px maximum),
a compact page heading, separated label/value rows, a monospace verification
code, and wrapping scope chips. Tenant-wide reach appears in an amber notice;
Deny and Approve sit together in the card footer. On narrow screens the
detail labels stack above their values.

`/approve-agent?code=XXXX-XXXX` is opened by the requesting agent's device
flow. The page:

- requires a signed-in session and returns to the same approval URL after
  sign-in;
- shows the machine/agent label, normalized user code, requested scopes, and
  request expiry before a decision;
- explains that approval creates a one-year credential across every project the
  signed-in account can currently access for project grants; catalog-only grants
  instead describe read access to the shared material library;
- labels `catalog:read` as **Read the shared material library**;
- shows a prominent warning when the account has tenant-wide
  `projects.access.all` reach and the grant includes `project:read`;
- permits exactly one **Approve** or **Deny** decision while the request is
  pending, then shows the terminal status; and
- links to **My agent tokens** for later revocation.

Approval sends the secret only to the polling agent. The page must never render,
log, copy, or otherwise expose it to the human.

Missing, invalid, expired, denied, and already-redeemed codes remain explicit
terminal/error states; they must not silently start a new authorization.

## My agent tokens

`/account/agent-tokens`, reached from the account menu, lists the signed-in
user's user-scoped machine credentials. Active rows permit revocation; revoked
and expired rows remain available under the collapsed inactive-token history.
Each row identifies the token by safe metadata (label/prefix, scopes,
issuance/last-use/expiry, and status). Empty, loading, fetch-error, and
revoke-error states remain visible.

New credentials are issued through agent login, not from this page. Project-
scoped issue/list/revoke controls remain in **Project Settings → MCP tokens** as
the optional one-project least-privilege path.

The device protocol, user/project token semantics, and revocation behavior are
canonical in `context/mcp.md`. Agent installation and operating guidance lives
in `docs/MCP_AGENT_SETUP.md`.
