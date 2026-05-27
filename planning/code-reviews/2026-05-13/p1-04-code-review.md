---
DATE: 2026-05-13
TIME: 16:15 EDT
STATUS: Code review of P1-04 deliverable
SCOPE: BLDGTYP design-system foundation. Reviews un-committed changes
       (`frontend/index.html`, `frontend/src/App.css`,
       `planning/ROADMAP.html`) representing the
       P1-04 phase against the roadmap, the UI/UX narrative, the
       TECH_STACK BLDGTYP-integration guidance, and the synthesis
       findings the slice was meant to absorb. Does not review against
       final-app completeness; downstream styling (Tailwind/shadcn
       primitives, dark mode, dashboard pin/reorder, Settings UI,
       DataTable) is explicitly out of scope per the P1-04 lessons.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - planning/ROADMAP.html (P1-04 row + ledger)
  - planning/archive/dated/2026-05-13/phase-1-full-buildout-plan.md (P1-04 detail)
  - planning/code-reviews/2026-05-13/p1-03-code-review.md (preceding slice)
  - context/UI_UX.md (§0 design intent, §1.1-1.7 common elements)
  - context/TECH_STACK.md (BLDGTYP design-system integration §)
  - context/CODING_STANDARDS.md (frontend conventions)
  - https://bldgtyp.github.io/branding/tokens/tokens.css (token source)
---

# Code Review — P1-04 BLDGTYP Design-System Foundation

## Scope Check

P1-04's stated scope from the roadmap:

> Move the Phase 1 app from scaffold styling to the BLDGTYP V2 product
> language. Includes Tailwind/shadcn token alignment; fonts; shared app
> primitives for buttons, dialogs, popovers, toasts, tabs, table
> chrome, badges, banners, and empty states; project shell polish.

From `phase-1-full-buildout-plan.md` §P1-04 completion gate:

> - sign-in, dashboard, project shell, Status, Equipment/Rooms,
>   settings, and version dialogs use one consistent visual language;
> - no Phase 1 feature adds new one-off global CSS when a shared
>   primitive fits;
> - desktop and narrow-tablet browser screenshots show no overlapping
>   text or broken controls.

Explicitly **not** in P1-04 scope (per the recorded P1-04 lessons and
the broader Phase 1 plan):

- Installing Tailwind / shadcn-ui themselves — deferred until a feature
  actually needs the primitives. Slice ships class-based CSS instead.
- Dark-mode wiring — "light/dark token posture if cheap, without
  making dark mode a separate feature goal."
- Settings modal styling — owned by P1-07 (the UI does not exist yet).
- DataTable visual contract from UI/UX §1.7 — owned by P1-08.
- Modal prompts, restore/discard dialog, beforeunload UX, IP/SI
  toggle, Viewer "Read-only" pill — owned by later P1 slices.
- Real V2 dashboard row metadata, pin/reorder, breadcrumb chrome —
  owned by P1-05.

This review evaluates only against the P1-04 scope as defined above.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `frontend/index.html` | Modified | Adds `data-theme="light"` on `<html>`; preconnects to Google Fonts; loads Outfit (200–700) + JetBrains Mono (300–400) via `?display=swap`. |
| `frontend/src/App.css` | Modified | Adds `@import` of BLDGTYP `tokens.css`; introduces seven `--phn-*` local variables; replaces ~all literal hex colors with token vars; restructures selectors into grouped chrome (card/border/background, layout, typography); adds graph-paper SVG backdrop to `.auth-panel` and `.status-empty`; promotes universal `button` to primary-blue accent style; bumps tablet breakpoint from 640 px to 760 px; +260 net lines. |
| `planning/ROADMAP.html` | Modified | P1-04 status → `[~] In review`; lessons row recorded; ledger updated. |

No backend, test, or component-markup changes. The `--phn-radius`
default is `var(--radius-sm)` (3 px) — matching BLDGTYP — but no
existing component markup was touched, so the diff is CSS-only.

## Verdict

**Approve with minor amendments before marking complete.** The slice
meets the stated completion gate: BLDGTYP `tokens.css` is imported
from the canonical URL, the two required font families are loaded
once in `index.html` with `preconnect`, `data-theme="light"` is set
on `<html>`, and the existing Phase-1 surfaces (sign-in, dashboard,
project shell, Status, Equipment/Rooms, version popover/dialogs) now
read color/border/background/typography from `--bg-*`, `--text-*`,
`--border-*`, `--accent*`, and `--highlight*` instead of literal
hexes. The visual direction matches the UI/UX §0 "technical workbench
for Passive House project data" framing.

That said, the slice has a small set of real divergences from the
BLDGTYP guidance that will resurface when (a) Tailwind/shadcn finally
lands, (b) dark mode is ever attempted, or (c) the user opens a
high-contrast / Windows-high-contrast / forced-colors render. None
are blockers for the stated gate, but H1 and M1 are worth fixing in
this slice because they are tiny changes that prevent ledger drift.

Out-of-scope items (Tailwind/shadcn install, dark-mode, primitives as
React components, DataTable chrome) are correctly deferred and called
out in the lessons row.

## Findings

Severity scale matches the synthesis convention (H = high, M = medium,
L = low / nit, P = positive note).

### H1 — Graph-paper SVG patterns hard-code rgba colors instead of using BLDGTYP `--svg-*` tokens

**Where:** `frontend/src/App.css:90-103` (`.auth-panel::before,
.status-empty::before`).

**Observation:** The two graph-paper backdrops embed `rgba(62,147,174,
0.10)` / `rgba(62,147,174,0.12)` directly in the inline SVG `stroke`
attributes:

```css
background-image:
  url("data:image/svg+xml,...stroke='rgba(62,147,174,0.10)'..."),
  url("data:image/svg+xml,...stroke='rgba(62,147,174,0.12)'...");
```

BLDGTYP's `tokens.css` exposes a documented graph-paper helper set
(`--svg-line-heavy`, `--svg-line-medium`, `--svg-line-light`,
`--svg-line-faint`, `--svg-fill-dot`, `--svg-text`), with per-theme
overrides — light theme uses `rgba(0,0,0,0.x)` and dark theme uses
`rgba(255,255,255,0.x)`. The hard-coded steel-blue rgba both (a) does
not match the BLDGTYP helper colors and (b) cannot follow a future
`data-theme="dark"` swap. The UI/UX §0 explicitly calls graph paper
out: *"Consider graph-paper treatments only where they reinforce
technical drafting/data context… Keep them subtle."* The
implementation correctly limits the treatment to the auth panel and
empty status — that part is right — but the color sourcing is wrong.

CSS `background-image: url(data:…)` cannot reference CSS custom
properties inside the embedded SVG markup, so this isn't a pure
search-replace. Two clean ways to fix it:

1. Switch to a CSS-only repeating-linear-gradient pattern that uses
   `var(--svg-line-faint)` / `var(--svg-line-light)` directly — works
   per-theme, no embedded color.
2. Render the SVG via a `<svg>` element behind the panel with
   `stroke="currentColor"` and set `color: var(--svg-line-light)` on
   the host element.

**Risk:** Low for Phase 1 (light-theme-only today). Becomes a real
theming bug the moment `data-theme="dark"` is set anywhere — also
contradicts the `color-scheme: light dark` declaration (see M1).

**Recommendation:** Use option (1) for the smallest patch — the
existing rectangle grid is reproducible with two repeating-linear-
gradients. Track this in the P1-04 lessons row as "graph-paper colors
not yet theme-aware."

### M1 — `color-scheme: light dark` advertises dark support that the rest of the file does not provide

**Where:** `frontend/src/App.css:3-15`, `frontend/index.html:2`.

**Observation:** `:root { color-scheme: light dark; }` tells the
browser that this page supports both color schemes; `index.html`
hard-codes `data-theme="light"` on `<html>`. The BLDGTYP token
overrides only fire on `[data-theme="dark"]`, so today the page is
locked to light tokens regardless of OS preference. The two
declarations together create a small mismatch: when the user is on a
dark-mode OS, native form controls (date inputs, scrollbars, focus
rings on `<input type="date">`, the file picker that drives the
HBJSON upload later) will render in dark-mode chrome while the rest
of the app remains BLDGTYP-light. This is exactly the visual
inconsistency the slice was meant to remove.

The roadmap accepts dark mode as deferred — that's fine. The fix is
to drop the `color-scheme: light dark` until dark mode is wired
up, or to keep `color-scheme: light` for now and re-add `light dark`
in the slice that ships theme switching.

**Risk:** Low; cosmetic and OS-conditional. Editor evidence on a
light-mode Mac would not catch this.

**Recommendation:** Change to `color-scheme: light;` for now. When
dark mode lands (post-MVP per `UI_UX.md` §0), bump it back to `light
dark` together with a runtime `data-theme` toggle.

### M2 — Custom `--phn-success/warning/danger` palette diverges from BLDGTYP's two-channel intent

**Where:** `frontend/src/App.css:8-13` (variable declarations) and
~16 use sites (`form-note-available`, `form-note-taken`,
`form-note-error`, `inline-action-error`, `form-error`, `draft-banner`,
`read-only-banner`, `save-state`, `danger-button`, `status-badge.done`).

**Observation:** UI/UX §0 (BLDGTYP design system) explicitly says:

> Use `--accent` / `--accent-text` as the primary action/accent
> channel. Use `--highlight` / `--highlight-text` sparingly for
> emphasis, warnings, missing evidence, or selected technical
> objects. Do not let magenta mean every action state.

The intent is two semantic channels — steel-blue accent for primary
action / success, magenta highlight for warning / drift /
missing-evidence. The P1-04 slice instead introduces a conventional
three-color webapp palette: green-blue `#2d6b80` for success
(actually accent-dark, see M3), amber `#8a5a00` for warning, and red
`#9b2f24` for danger. The amber/red are not BLDGTYP tokens. Neither
is the success-bg `#e9f5ef`, warning-bg `#fff6d9`, or danger-bg
`#fff0ee`. `--highlight` is currently not used for warnings *at all*
— `draft-banner` and `read-only-banner` use the custom amber
instead.

This is a defensible product decision (amber is more universally
read as warning than magenta) but it leaves the slice in a state
where:

- A future Tailwind/shadcn pass that maps `--destructive`,
  `--warning`, etc. to BLDGTYP variables can't reuse these channels —
  there are now two sources of truth for "warning state."
- The Specifications sub-tab (P1-08+) and Status missing-evidence
  states (per UI/UX §1.8) will want to express *Missing*, *Drifted*,
  and *Refresh-from-catalog* via `--highlight` per the design intent.
  The current `--phn-*` palette doesn't include a "missing /
  drifted" channel and would need yet another color.

**Risk:** Low for current Phase 1 visuals (light-mode, no
missing-evidence UI yet). Rises sharply when shadcn tokens are wired
in P1-08 or when Specifications/missing-evidence colors are needed
(later in Phase 2 / P1-08).

**Recommendation:** Either (a) acknowledge in the P1-04 lessons row
that the slice intentionally introduced a 3-channel palette outside
BLDGTYP and that the future shadcn pass will need to reconcile, or
(b) remap two of the three channels: success → `--accent` /
`--accent-text` (already byte-identical, see M3), warning →
`--highlight` / `--highlight-text` for missing-evidence / drift
states, and keep `--phn-danger` (red) as the only custom semantic
because BLDGTYP has no destructive channel. (b) is preferred — it
preserves the design-system intent and reduces the variable count.

### M3 — `--phn-success: #2d6b80` is byte-identical to BLDGTYP `--accent-dark`

**Where:** `frontend/src/App.css:8`.

**Observation:** BLDGTYP `tokens.css` defines
`--accent-dark: #2d6b80`. P1-04 defines
`--phn-success: #2d6b80`. Two names, one color, no source-of-truth.
If BLDGTYP ever bumps `--accent-dark`, `--phn-success` will silently
drift. This is the smallest case of the larger M2 finding but is
trivially fixable.

**Risk:** Negligible today; latent for any palette change.

**Recommendation:** Either drop `--phn-success` and use
`var(--accent-dark)` (or `var(--accent-text)`, which aliases to
`--accent-dark` under `data-theme="light"`) at the four call sites,
or redefine `--phn-success: var(--accent-dark);` so the dependency
is explicit. The latter is the smaller patch.

### M4 — Universal `button` selector sets every `<button>` to a primary blue accent

**Where:** `frontend/src/App.css:586-617` (the `download-link, button`
ruleset).

**Observation:** The base `button { … }` block — coupled with
`.download-link` — applies the primary accent style (uppercase mono
text, `--accent` background, `--accent-dark` hover, 38 px min-height,
6 px padding, dotted border-radius) to **every** un-classed button on
the page. The downstream selectors (`.secondary-button`,
`.text-button`, `.subtabbar button`, `.status-state-button.todo`,
`.status-state-button.done`, `.status-state-button.na`,
`.icon-button`, `.danger-button`, `.date-pill`,
`.status-title-button`, `.status-description-empty`) each override
specific properties. That works today because the cascade order is
correct, but it has three side-effects worth recording:

1. **Every button inherits `text-transform: uppercase` and `font-
   family: var(--font-mono)` by default.** Buttons that want
   sentence-case body text (e.g. `.status-title-button`,
   `.status-description-empty`) have to explicitly reset
   `text-transform: none; letter-spacing: 0; font-family:
   var(--font-primary)` — which they do. Future buttons will need to
   remember the same reset.

2. **shadcn / Radix portal-rendered buttons (post-P1-08) will inherit
   the same blue-accent base.** When `<Button variant="ghost">` or a
   shadcn Dialog close button lands, it will read the universal
   button style first and need a higher-specificity override to look
   non-primary. shadcn's tailwind classes will win on specificity,
   but only if they're emitted; class-conflicts can be subtle.

3. **`.icon-button` (32 px square) inherits the same 38 px
   min-height** plus uppercase mono font, even though it's only used
   for arrow / chevron icons. `.icon-button` currently sets
   `width: 34px; min-width: 34px; padding: 0;` and nothing else.
   Result: a 34×38 button, not 32×32 — and any text inside is mono /
   uppercase.

**Risk:** Low today (the existing override cascade catches the cases
that matter). Becomes friction in P1-08 when shadcn arrives. Also
slightly off-spec for `.icon-button`.

**Recommendation:** Add a `.primary-button` (or `.button-primary`)
class and apply the primary styling to that explicit class plus
`.download-link`. Leave the base `button { cursor: pointer; }` rule
intact so unstyled buttons remain accessible. Then mark the existing
"primary action" buttons with that class in markup. This is a small
markup change (~10 components) but it lets P1-08 / shadcn map
`--primary` to the BLDGTYP accent without a global cascade
collision. If markup changes are out of scope for this slice (lessons
say "future shadcn/Tailwind work should map to these same variables
rather than reintroducing a separate palette"), record this as a
known migration cost in the lessons row.

### M5 — `.brand::after { content: " / v2" }` injects visible text via CSS pseudo-content

**Where:** `frontend/src/App.css:266-269`,
`frontend/src/shared/ui/WorkspaceTopbar.tsx:7-9`.

**Observation:** The `<a className="brand">PH-Nav</a>` markup says
"PH-Nav"; the rendered text reads "PH-Nav / v2" because of
`.brand::after { content: " / v2"; }`. Pseudo-element content has
three real downsides:

1. **It is not copyable.** A user who selects-all and copies the
   header will copy "PH-Nav" but not "/ v2".
2. **It is not searchable.** Browser find-in-page on "v2" misses the
   header.
3. **Screen-reader behavior is inconsistent across browsers.** Chrome
   and Safari read CSS pseudo-content; older NVDA/JAWS configs may
   skip it. The brand link has `aria-label="PH-Navigator dashboard"`
   which already names the link correctly, so the "/ v2" is purely
   decorative — but treating it as decoration in CSS only works if
   the rest of the UI doesn't promise it as a version indicator.

The UI/UX §1.1 spec says: "*Far left: PH-Nav logo (wordmark + minimal
graphic mark). Clicking returns to `/dashboard`.*" There's no `v2`
requirement in the spec; the suffix appears to be a P1-04 stylistic
add.

**Risk:** Low. Affects copy/paste only; accessibility is acceptable.

**Recommendation:** Either move the version suffix into the `<a>`
text (e.g. `<a>PH-Nav <span className="brand-version">v2</span></a>`)
and style the `<span>` with the muted color, or drop the suffix
entirely. If kept, document the intent ("PHN-V2 build" indicator) in
the lessons row so future readers understand why the CSS
disagrees with the markup.

### M6 — Google Fonts is loaded from `fonts.googleapis.com` rather than self-hosted

**Where:** `frontend/index.html:6-11`.

**Observation:** The fonts are loaded from
`https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400&display=swap`,
preconnected to both `fonts.googleapis.com` and `fonts.gstatic.com`.
Two minor concerns:

1. **Offline / restricted-network development.** A dev environment
   without internet access (or behind a corp proxy that blocks
   Google CDN) will fall back to system `sans-serif` /
   `monospace`. The `&display=swap` query already prevents the
   "invisible text flash" failure mode, so this is graceful. But it
   means local screenshots may not match staging.
2. **Privacy posture.** Google Fonts hot-loading sends the visitor's
   IP to Google. PH-Navigator V2 is an internal tool for two
   editors; that may not matter for the editor app, but the public
   Viewer route (`/projects/{id}/{tab}`) is shared with contractors
   and certifiers. If those parties are EU-based, hot-loading
   Google Fonts on a public route is a GDPR concern that legal
   teams at architecture firms sometimes do flag.

`UI_UX.md` doesn't take a position. `TECH_STACK.md` §"BLDGTYP design-
system integration" step 1 says "Load the required fonts once: Outfit
and JetBrains Mono" — it doesn't say *where* from.

**Risk:** Low; the app works, fonts load, fallback is clean.

**Recommendation:** Out of scope to fix now, but record the choice
explicitly. Future options: (a) self-host via `@fontsource/outfit` /
`@fontsource/jetbrains-mono` npm packages with the Vite asset
pipeline, (b) ship a local woff2 copy and load via `@font-face` rules
in App.css, (c) accept the current Google-hosted load and note the
privacy posture. (a) is the cleanest npm-native path; lean to (a)
once Tailwind/shadcn lands.

### M7 — Slice produces CSS classes, not React component primitives, despite the roadmap "shared app primitives" language

**Where:** Entire `App.css` diff; no new files under
`frontend/src/shared/ui/`.

**Observation:** The P1-04 plan says:

> shared app primitives for buttons, dialogs, popovers, toasts, tabs,
> table chrome, badges, banners, and empty states

`UI_UX.md` §1.3-1.7 expects shadcn `Dialog`, shadcn `Sonner` / `Toast`,
shadcn `Button`, shadcn `Tabs`, and a single `<DataTable>` component.
The P1-04 deliverable installs none of these. It styles the existing
class-based markup (e.g. `.modal-panel`, `.tabbar`, `.subtabbar
button`, `.data-table`, `.draft-banner`, `.read-only-banner`,
`.empty-state`, `.status-empty`) to look BLDGTYP-native. That is a
real divergence from the slice as planned, and the recorded P1-04
lesson acknowledges it:

> PH-Navigator-specific primitives stay class-based for now because
> Tailwind/shadcn is not yet installed in the scaffold; future
> shadcn/Tailwind work should map to these same variables rather than
> reintroducing a separate palette.

That's a defensible scope cut: it preserves visual continuity now
and defers component-API work to when shadcn lands. But it also
means the completion-gate clause "no Phase 1 feature adds new one-
off global CSS when a shared primitive fits" is **structurally
unenforceable** until shadcn arrives. P1-05 / P1-06 / P1-07 will
need to either reuse the existing class names or add new ones, and
neither path is a real primitive.

**Risk:** Medium for the slice's stated gate (it can't fully hold),
low for the codebase (the deferral is recorded).

**Recommendation:** Either (a) widen the P1-04 lesson row to call
this out explicitly as a planned-vs-shipped delta — "the slice
ships token-mapped CSS classes; the named primitives (`<Button>`,
`<Dialog>`, `<Popover>`, `<Toast>`, `<Tabs>`, `<Badge>`, `<Banner>`,
`<EmptyState>`) are deferred to the slice that installs Tailwind/
shadcn" — or (b) re-scope the next slice (P1-05 / P1-08) to install
Tailwind + shadcn and replace at least the small primitives
(`<Button>`, `<Badge>`, `<Banner>`, `<EmptyState>`). (a) is the
smaller, ledger-only change.

### L1 — Sticky `.topbar` z-index (20) is higher than `.version-popover` (10) in the same stacking context

**Where:** `frontend/src/App.css:237-250` (topbar),
`frontend/src/App.css:556-564` (version-popover),
`frontend/src/App.css:464-471` (modal-backdrop).

**Observation:** The version-popover opens downward from the version
button (`top: calc(100% + 6px)`), so in practice it lives below the
sticky topbar and never overlaps it. The modal-backdrop sits at
z-index 50, well above both. So there's no visible bug today. But
the popover's `z-index: 10` is meaningfully lower than the topbar's
`z-index: 20`, and `.version-control-wrap` (`position: relative` with
no `z-index`) doesn't create a stacking context that isolates them.
If a later slice opens the popover upward (placement: top) or moves
the popover into a header section that ends up above the topbar in
DOM order, the topbar will paint on top of the popover.

**Risk:** Very low; conditional on future placement changes.

**Recommendation:** Bump the version-popover to `z-index: 30` (still
below modal backdrop at 50) so it cannot be clipped by the sticky
topbar regardless of placement choice. One-line fix.

### L2 — `cursor: default` on `.topnav a` applies to all topnav links, not just the disabled Catalogs placeholder

**Where:** `frontend/src/App.css:289-291`,
`frontend/src/shared/ui/WorkspaceTopbar.tsx:10-12`.

**Observation:** Today the only topnav link is the disabled Catalogs
placeholder (`<a aria-disabled="true">Catalogs</a>` with no `href`).
Setting `cursor: default` is right for that one element. But once
P1-05 ships the working Catalogs dropdown (UI/UX §1.1) or any other
top-level nav link, those will also inherit `cursor: default` and
look unclickable. The right selector is
`.topnav a[aria-disabled="true"] { cursor: default; }`.

**Risk:** Low; P1-05 will likely re-touch this area.

**Recommendation:** One-line selector fix now or flag for P1-05.

### L3 — `text-rendering: geometricPrecision` on `body` is a small perf cost

**Where:** `frontend/src/App.css:26-33` (body).

**Observation:** `text-rendering: geometricPrecision` favors precise
glyph shapes over speed; the more common workbench choice is
`optimizeLegibility` (which enables kerning + ligatures without the
full geometric path). On modern hardware the difference is invisible;
on long Status timelines or dense tables (post-P1-08 DataTable) it
can shave a few ms per repaint. Not a real problem.

**Risk:** Negligible.

**Recommendation:** Leave as-is unless the DataTable extraction
surfaces measurable text-render cost.

### L4 — `box-sizing: border-box` on universal `*` will collide with Tailwind preflight later

**Where:** `frontend/src/App.css:17-19`.

**Observation:** Tailwind's preflight already sets
`*, ::before, ::after { box-sizing: border-box; }`. Once Tailwind
lands, both will be active; the second declaration just wins
(harmless). Worth noting only because the universal selector is
slightly cheaper to drop than to migrate.

**Risk:** None today; cosmetic later.

**Recommendation:** No change. Remove during the Tailwind-install
slice.

### L5 — `backdrop-filter` on `.topbar` lacks `-webkit-` prefix

**Where:** `frontend/src/App.css:249`.

**Observation:** Modern Safari (16+) and Chrome 76+ / Firefox 103+
support `backdrop-filter` unprefixed. Older iOS / older Safari < 16
need `-webkit-backdrop-filter`. PHN-V2's audience is two editors on
modern Macs, but contractor / certifier Viewers may be on slightly
older devices.

**Risk:** Negligible for the primary editor experience.

**Recommendation:** Add `-webkit-backdrop-filter: saturate(1.4)
blur(14px);` alongside the unprefixed declaration. One line.

### L6 — Eyebrow/viewer-controls weight is now `300` (Light); some contrast vs. dense data is reduced

**Where:** `frontend/src/App.css:125-133` (`.eyebrow`),
`frontend/src/App.css:295-299` (`.user-menu`),
`frontend/src/App.css:395-407` (grouped `.viewer-controls` etc.).

**Observation:** `body { font-weight: 300 }` plus the grouped text-
secondary block makes most non-headline text render in Outfit Light
or Light italic at small sizes. This is consistent with the BLDGTYP
"quiet, precise" design intent, but at small sizes against
`--bg-card` (`#ffffff`) the contrast ratio for `--text-secondary`
(`#6b7280`) at weight 300 is right around WCAG AA for normal text
(~4.6:1). Critical states still render in `--text-primary` /
`--phn-danger` / `--phn-warning`, all of which are fine. Worth
spot-checking during the screenshot pass — Outfit Light at 0.72rem
mono can read thin on a high-DPI display but visually crowded on a
1080p external monitor.

**Risk:** Low; visual regression risk caught by the screenshot pass
called out in the lessons row.

**Recommendation:** No change unless the screenshot pass surfaces
contrast complaints. If it does, bump `.eyebrow` and any uppercase-
mono label to weight 400 instead of 300 — the BLDGTYP "JetBrains
Mono" guidance in UI/UX §1.1 supports either weight.

### L7 — `.viewer-controls` lost its bold weight and dark color

**Where:** `frontend/src/App.css:395-407`,
`frontend/src/features/project_document/components/VersionControls.tsx:63`.

**Observation:** The original `.viewer-controls { color: #59564d;
font-weight: 700; }` produced a bold dark-gray "Working" /
"Read-only" label in the viewer header. The new grouped selector
produces a light-weight text-secondary version. This is consistent
with the design intent but is a visible regression from the
previous tracer styling — the viewer-mode version label is now
harder to see at a glance. The screenshot pass should specifically
include the viewer-mode header on a public project URL.

**Risk:** Low; visual-only.

**Recommendation:** Verify in the screenshot pass; consider adding
`.viewer-controls { font-family: var(--font-mono); font-weight:
400; letter-spacing: 0.06em; text-transform: uppercase; }` if the
viewer-mode label needs more emphasis.

### L8 — `.read-only-banner` is still a banner, not the UI/UX-spec "Read-only pill in header"

**Where:** `frontend/src/App.css:522-527`,
`frontend/src/features/projects/routes/ProjectShell.tsx:120,174`.

**Observation:** UI/UX §2.11 says the Viewer should see "a
'Read-only' pill next to the project/version label." The current
implementation is a full-width amber banner across the top of the
tab content. This was already the case before P1-04 — the slice
didn't change the markup, just the colors. So this is **not a P1-04
regression**, but the design-system slice was a reasonable place to
do the pill conversion (it's a styling-only change). P1-05 will
own this when it does the "workspace header, breadcrumbs, tab
routing, Viewer/read-only separation" work per the roadmap.

**Risk:** None.

**Recommendation:** No change in P1-04. Flag for P1-05.

### P1 — BLDGTYP tokens imported correctly from the canonical URL

`@import url("https://bldgtyp.github.io/branding/tokens/tokens.css")`
on App.css line 1 matches the URL given in `TECH_STACK.md` §"BLDGTYP
design-system integration." `data-theme="light"` on `<html>` matches
step 3. Fonts loaded once via `index.html` with `preconnect` matches
step 1 and is the right performance shape. The local
`--phn-radius: var(--radius-sm)` adapter is the right pattern for
PHN-specific extensions that need to point at BLDGTYP values.

### P2 — Token usage is comprehensive, not partial

`--bg-page`, `--bg-card`, `--bg-elev`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--border-card`,
`--border-subtle`, `--border-strong`, `--accent`, `--accent-dark`,
`--accent-light`, `--accent-text`, `--highlight-text`,
`--highlight-darker`, `--font-primary`, `--font-mono`, `--radius-sm`,
`--ease` are all referenced. The only token category that the slice
*didn't* reach for is the `--svg-line-*` graph-paper set (H1) and
the destructive channel (which doesn't exist in BLDGTYP). This is
the right "comprehensive but not aggressive" sweep for a foundation
slice.

### P3 — P1-03 M5 (`.version-list` reuse in read-safe panel) is addressed

`ProjectShell.tsx:217-232` now renders the recovery panel's version
buttons inside `.read-safe-versions` + `.read-safe-version-list`,
and the App.css grouped selector (`.read-safe-versions, .read-safe-
version-list` in the auth-form / project-form grid block) gives the
panel its own grid wrapper. Two unrelated UI affordances no longer
share the `.version-list` class. P1-03 M5 fix lands here cleanly.

### P4 — Visual direction matches UI/UX §0 "technical workbench" framing

The grouped mono-uppercase eyebrow / metadata-header treatment, the
graph-paper backdrop on the auth panel and empty status, the steel-
blue accent on `current` status state, the sticky topbar with mono
brand, and the small `--phn-radius` (3 px) all read as a "quiet,
precise, data-rich workbench" rather than the V1 generic-admin
aesthetic. The slice respects the §0 guidance "Clarity over polish.
Information hierarchy and discoverability matter more than visual
flourish."

### P5 — Narrow-tablet breakpoint bumped from 640 px to 760 px is the right cut-off

The bump from `@media (max-width: 640px)` to `(max-width: 760px)`
matches the lessons row's "narrow-tablet" framing and gives the
collapsing topbar / metadata-grid / status-item a chance to stack
on iPad mini and small Surface devices before the layout breaks.
Internally consistent with the UI/UX §1.1 note "Phone is non-goal,
narrow widths collapse breadcrumb."

## Out-of-scope but worth recording

- **Tailwind / shadcn install.** P1-04 lessons acknowledges the
  deferral; track explicitly that the slice that installs Tailwind
  must also re-evaluate findings M2 (palette), M4 (universal button),
  L4 (`box-sizing: *`), and M7 (CSS-vs-component primitive question).
- **Dark mode.** Deferred per the slice plan. Findings H1 (graph-
  paper colors) and M1 (`color-scheme`) become real bugs the moment
  `data-theme="dark"` is set anywhere. Either ship the dark variant
  with the same slice that introduces a theme toggle, or remove the
  `color-scheme: light dark` advertisement.
- **High-contrast / `forced-colors` mode.** Not covered. Windows
  high-contrast renderings will currently lose the BLDGTYP color
  language entirely. Out of scope for an internal tool; record as a
  v1.1 follow-up if any contractor / certifier flags it.
- **Settings UI styling.** Explicitly deferred to P1-07. The lessons
  row records this; no action needed in P1-04.
- **DataTable visual contract (UI/UX §1.7).** Owned by P1-08. The
  current `.data-table` styles are minimal scaffolding only;
  sticky-left identifier column, 32 px row height, frozen gutter,
  selection / focus / active-cell visuals, and the per-column tint
  layering all land in P1-08.
- **`<Toast>` / `<Sonner>` styling.** No toast provider is wired up
  yet. UI/UX §1.4 wants shadcn `Sonner` for save-success and 409-
  conflict feedback. That waits for shadcn install.

## Verification

The roadmap ledger for P1-04 cites:

- `cd frontend && npm run format:check`;
- `cd frontend && npm run lint`;
- `cd frontend && npm test` (23 passed);
- `cd frontend && npm run build`;
- `cd frontend && npm run test:e2e` (2 passed);
- Browser screenshots for sign-in, dashboard, project shell / Status,
  Equipment / Rooms, and version popover / dialog at desktop plus
  narrow-tablet.

I did not re-run the toolchain or re-capture screenshots. The
recorded evidence is consistent with the diff under review. The
screenshots themselves are not committed to the repo (none under
`docs/`, `screenshots/`, or `frontend/`), so this review trusts the
roadmap claim that they were captured. If the slice should ship
durable visual evidence, add the screenshots under `docs/code-
reviews/2026-05-13/screenshots/` or reference an external location.

## Recommended Disposition

Mark P1-04 complete after the following minimal amendments:

1. **H1**: Reroute graph-paper SVG colors through BLDGTYP
   `--svg-line-*` tokens (or switch to a repeating-linear-gradient
   that consumes the tokens directly). Otherwise dark-mode is
   structurally broken on those two surfaces.
2. **M1**: Drop `color-scheme: light dark;` to `color-scheme: light;`
   until dark mode is wired up. One-line change.
3. **M3**: Either drop `--phn-success` and use `var(--accent-dark)`
   directly, or redefine as `--phn-success: var(--accent-dark);` so
   the dependency is explicit.
4. **M5**: Move the "/ v2" suffix into `<a>` markup with a `.brand-
   version` span, or drop the suffix. Pseudo-content for visible app
   identity text is the wrong layer.

M2 (custom palette vs BLDGTYP two-channel intent) and M7 (primitives
as CSS, not components) are accepted as recorded deferrals if the
P1-04 lessons row is widened to call out both explicitly — that
prevents the next slice (P1-05) from re-deciding silently.

M4 (universal button), M6 (Google Fonts loading), L1 (popover z-
index), L2 (`cursor: default`), L3-L7 are all accepted as polish
that rides with later slices. L8 (Viewer pill vs banner) is a P1-05
item, not a P1-04 issue.

Phase 1 gating: P1-04 is independent of TB-07 (Phase 2). The Phase 2
gates remain P1-01 / P1-02 / P1-03 (all done or in review) plus
P1-08 (DataTable extraction). No new gating from this slice.

## Disposition After Review / Simplify

Follow-up review and simplify cleanup addressed the small P1-04
amendments that were worth landing inside this slice:

- **H1 / M1 / M3:** graph-paper backgrounds now use CSS gradients fed
  by BLDGTYP `--svg-line-*` tokens; `color-scheme` is light-only until
  real dark-mode support lands; `--phn-success` aliases
  `--accent-dark`.
- **M5:** the `/ v2` suffix moved from CSS pseudo-content into
  `WorkspaceTopbar` markup.
- **M4:** the global button rule was narrowed into a neutral base plus
  explicit current action selectors, reducing pre-shadcn cascade debt.
- **L1 / L2 / L5:** version popover z-index, disabled topnav cursor,
  and Safari backdrop-filter prefix were fixed.
- **Simplify findings:** BLDGTYP `tokens.css` now loads from
  `index.html` before app CSS instead of through `@import`; requested
  Google font weights were trimmed to the active app weights; the
  read-safe recovery download link reuses `download-link`; the
  `.status-empty` grid/gap and `.icon-button` square sizing were
  restored.

Still deferred by design: full Tailwind/shadcn install and React
primitive extraction, Toast/Sonner provider, DataTable visual contract,
dark-mode toggle, self-hosted fonts, and the Viewer read-only pill.
Those remain owned by the later slices named in the roadmap.
