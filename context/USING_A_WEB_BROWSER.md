# Using a web browser (agents): the reliable path

**If you need to load, click, or screenshot the app, use the self-cleaning
Playwright helper — not the browser MCP tools.** It works every time, needs no
pairing, and never collides or leaks processes.

```bash
make agent-browser-ready          # once: start :5173/:8000 + seed the fixture
cd frontend
node scripts/agent-browser.mjs /projects/<id>/apertures --out /tmp/shot.png
```

Then `Read /tmp/shot.png`. That's it. The rest of this doc explains why the MCP
browser tools are unreliable, the helper's recipes, and the cleanup discipline.

---

## Why the browser MCP tools keep failing (root cause)

The `@playwright/mcp` and `chrome-devtools-mcp` MCP servers launch the user's
**real Google Chrome** against **one shared persistent profile**
(`~/Library/Caches/ms-playwright-mcp/mcp-chrome-*`). Chrome allows only **one
instance per profile**, so the moment a second session — or a leftover zombie
MCP process from a dead session — tries to use it, you get:

> `Browser is already in use for …/ms-playwright-mcp/mcp-chrome-XXXX, use --isolated`

Two things make this chronic:

1. **Zombie processes.** Ended Claude Code sessions routinely leave
   `playwright-mcp` / `chrome-devtools-mcp` node processes (and their Chrome)
   running. They hold the profile lock forever. (We have seen a dozen+ orphans
   accumulate across a day.)
2. **Shared profile, no isolation.** Without `--isolated`, every session fights
   over the same profile lock.

Separately, the **`claude-in-chrome` extension** requires a manual per-session
pairing that has never reliably paired in this environment. Don't rely on it.

### What we changed to reduce the pain

- `.mcp.json` now runs the `playwright` MCP server with `--isolated --headless`
  (ephemeral in-memory profile → no shared lock, no window stealing). This takes
  effect on the **next** session, not the current one.
- `frontend/scripts/agent-browser.mjs` — the reliable, MCP-independent driver
  below. **Prefer it.**
- `frontend/scripts/agent-browser-cleanup.mjs` — reaps orphaned MCP tooling.

---

## The reliable driver: `frontend/scripts/agent-browser.mjs`

Uses the repo's **own** installed Playwright (bundled Chromium, `chromium.launch()`
with a fresh ephemeral context). It cannot hit the shared-profile lock, does not
touch the user's Chrome, and **closes its browser in a `finally` block — so it
never leaks a process.**

Prereqs: dev servers up (`make agent-browser-ready`, which also prints the login
+ a seeded project route). Sign-in defaults to `ed@example.com` / `password`;
override with `E2E_EMAIL` / `E2E_PASSWORD` (the seeded `AGENT-BROWSER` fixture is
`codex@example.com`).

### Recipes

```bash
cd frontend

# Screenshot a route (signs in automatically):
node scripts/agent-browser.mjs /projects/<id>/apertures --out /tmp/a.png

# Drive a flow, then shoot (clicks run in order; selectors are Playwright locators).
# Sort is now a menu: open it, then pick Manual (there is no #...-sort-manual id):
node scripts/agent-browser.mjs /projects/<id>/apertures \
  --click "text=Close" --click "[aria-label='Aperture Types order']" --click "text=Manual" --out /tmp/manual.png

# Verify PERSISTENCE across reload: the app debounces saves ~500ms, so a run that
# clicks-then-closes too fast never fires the PUT. Use --settle to wait it out,
# then re-run clean and confirm the state stuck:
node scripts/agent-browser.mjs /projects/<id>/apertures \
  --click "text=Close" --click "[aria-label='Aperture Types order']" --click "text=Manual" --settle 1200 --out /tmp/set.png
node scripts/agent-browser.mjs /projects/<id>/apertures --click "text=Close" --out /tmp/reload.png

# Public page, no sign-in; full-page shot; watch it live:
node scripts/agent-browser.mjs /sign-in --no-signin --full --headed --out /tmp/signin.png
```

Or via make: `make agent-shot ROUTE=/projects/<id>/apertures OUT=/tmp/a.png ARGS="--settle 1200"`

Every run prints the final URL, the screenshot path, and any **page console
errors** (so you can spot failed requests). Exit code is non-zero on failure,
with a best-effort failure screenshot.

### When the driver isn't enough

For interactions the flag DSL can't express (drag-and-drop, network assertions,
multi-page), write a ~20-line scratch script importing `playwright` directly and
copy the `chromium.launch()` + `finally { await browser.close() }` shape from
`agent-browser.mjs`. Never use `launchPersistentContext` with the shared MCP
profile. There are also full e2e specs under `frontend/tests/e2e/` (helpers in
`_helpers.ts`) — run one with `cd frontend && pnpm exec playwright test <spec>`.

---

## Process-cleanup discipline (never leave what you started)

**Rule:** if a process was already running before you touched it, leave it. If
**you** started one for testing, kill it when you're done.

- **`agent-browser.mjs` handles this for you** — it always tears down its own
  browser. This is the whole reason to prefer it; you can't forget to clean up.
- **If you background a server/process yourself** (a dev server, a watcher),
  track its PID and kill it when finished in the same task.
- **MCP browser zombies** from prior/dead sessions are the exception you *should*
  reap — they're agent tooling, not the user's work, and they hold the lock:

  ```bash
  make agent-browser-cleanup           # reap orphaned MCP tooling + stale profiles
  make agent-browser-cleanup DRY=1     # preview only
  ```

  Run it at the **start** of browser work (clear leftovers), or when a lock
  blocks you — **not** mid-use of the MCP browser in another window. It matches
  only `@playwright/mcp` / `playwright-mcp` / `chrome-devtools-mcp` /
  `ms-playwright-mcp/mcp-chrome` and **never** touches your real
  Chrome/Vivaldi/Safari or the Claude.app host.

> Note: the harness auto-respawns the `playwright` MCP server from `.mcp.json`.
> Reaping it in the current session just makes it come back — that's expected and
> harmless; the point of the reaper is clearing **cross-session orphans**.

---

## Quick triage

| Symptom | Do this |
| --- | --- |
| "Browser is already in use … use --isolated" (MCP) | `make agent-browser-cleanup`, then use `agent-browser.mjs` instead |
| `claude-in-chrome` won't pair | Don't use it; use `agent-browser.mjs` |
| `ERR_CONNECTION_REFUSED` / blank page | `make agent-browser-ready` (servers were down) |
| Screenshot shows a login page | sign-in failed — check `E2E_EMAIL`/`E2E_PASSWORD`; the fixture user is `codex@example.com` |
| State didn't persist on reload | add `--settle 1200` (saves are debounced ~500ms) |
| Dozens of stray `playwright-mcp` procs | `make agent-browser-cleanup` |
