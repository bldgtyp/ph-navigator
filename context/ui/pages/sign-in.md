> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.1 Sign-in page (`/sign-in`)

**Purpose:** Authenticate Ed or John into the app.

**Layout:** Single centered card on a neutral background. Card width
~400 px max.

**Content (top to bottom):**
- PH-Nav logo, larger than in the header. Visual anchor.
- Title: "Sign in to PH-Navigator".
- Email input (autocomplete `email`).
- Password input (autocomplete `current-password`, with show/hide eye
  toggle).
- "Sign in" primary button (full-width).
- Below the button, small text: "Trouble signing in? Contact Ed." (no
  self-serve forgot-password in v1; admin reset only).
- No social login buttons. No "create account" link.

**Behavior:**
- On load, focus the email input.
- Form is submitted on Enter from either field.
- During submission, button shows loading state; inputs disabled.
- On failure: red error banner above the form: "Email or password is
  incorrect."
- On success: redirect to `/dashboard` (or to `?next=` if present).

**Accessibility:**
- Proper `<label>`s, `<form>` semantics, focus management.
- Error banner uses `role="alert"`.

