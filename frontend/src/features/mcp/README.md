# mcp feature

This feature manages **MCP (Model Context Protocol) bearer tokens** for both
supported principals:

- Project-scoped token issue/list/revoke controls stay in Project Settings.
- User-scoped agent tokens are listed and revoked at
  `/account/agent-tokens`, reachable from the account menu.

`api.ts`, `hooks.ts`, and `types.ts` carry the shared client contract;
`components/McpTokenList.tsx` renders both token lists; and
`routes/AgentTokensPage.tsx` owns the account surface. Plaintext user-token
delivery is handled by the device authorization flow, not this page.
