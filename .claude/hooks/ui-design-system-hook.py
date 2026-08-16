#!/usr/bin/env python3
"""PreToolUse hook: put the design system in front of every UI edit.

Docs only work if they are open at the moment of the decision. An agent editing
one CSS rule does not re-read `context/DESIGN_SYSTEM.md` on its own, and that is
exactly how off-system UI arrives — a hand-picked hover color, a re-invented
row, a fifth grey. This hook fires on Edit/Write against files that paint UI and
injects the routing plus the rules that are most often re-invented.

Reads a Claude Code hook payload on stdin; prints a `hookSpecificOutput` JSON
object (or nothing, when the edit does not touch UI).
"""

import json
import re
import sys

# Files that paint UI: stylesheets anywhere in the frontend, plus the React
# surfaces (feature components/routes and the shared primitives).
CSS = re.compile(r"frontend/src/.*\.css$")
COMPONENT = re.compile(r"frontend/src/(features|shared|app)/.*\.tsx$")
TOKENS = re.compile(r"frontend/src/styles/(tokens|brand/tokens)\.css$")

REMINDER = (
    "design system (context/DESIGN_SYSTEM.md) — this file paints UI, so the "
    "visual answer is already decided somewhere; take it, don't invent it:\n"
    "  * STATES — hover / selected / armed / focus / disabled come from "
    "§ Interaction states and the --state-* tokens in styles/tokens.css. Row "
    "surfaces tint the background (neutral hover, teal selection); DRAWN "
    "surfaces (canvas bands, key-view edges, assembly segments) take a ring: "
    "`outline: var(--state-ring-width) solid transparent` at rest, "
    "`outline-offset: var(--state-ring-offset)` so it is INSET — an outset "
    "ring gets clipped by the neighbouring band or the canvas edge.\n"
    "  * COMPONENTS — § Component inventory. Reuse the class or the shared/ui "
    "component before writing new CSS.\n"
    "  * DIALOGS — § Modal contract: ModalDialog + DialogActions, footer is "
    "Cancel/primary only.\n"
    "  * VALUES — every color/space/radius/size/weight/z is a var(--token); "
    "`pnpm run check:all` rejects the rest.\n"
    "If nothing in the system fits, extend the system (token + DESIGN_SYSTEM.md "
    "in the same commit) instead of solving it locally."
)

TOKEN_NOTE = (
    "You are editing the token layer itself. New tokens are a design-system "
    "change: name the role (not the value), add it beside the group it belongs "
    "to, and document it in context/DESIGN_SYSTEM.md in the same commit — the "
    "Portable-spec snapshot is what external design tools read."
)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    tool_input = payload.get("tool_input", payload)
    path = str(tool_input.get("file_path") or "").replace("\\", "/")
    if not path:
        return
    if TOKENS.search(path):
        context = f"{REMINDER}\n\n{TOKEN_NOTE}"
    elif CSS.search(path) or COMPONENT.search(path):
        context = REMINDER
    else:
        return
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": context,
            }
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
