---
name: implement-loop
description: Read the docs indicated by the user and implement the entire feature phase by phase, repeating until all planning docs are complete.
---

# Arguments

- path (required): Directory to read and review. Must be supplied — see "Path guard" below.

# Path guard

Never silently default to the current working directory. Project folders can be huge (hundreds of subfolders, thousands of files) and an unintended recursive index is slow and expensive.

If no path is supplied:

1. **Stop before doing any work** — do not scan, walk, or read anything.
2. **Ask the user to confirm the target.** Show the CWD as a candidate but require an explicit yes before proceeding: e.g. "No path given. Did you mean to index the CWD `<cwd>`? Or supply a different path."
3. Only proceed once the user confirms or supplies a path.

# Implement Loop

- First, review the planned feature or refactor documents indicated by the user. Start by reading any `PRD` or `STATUS` documents which outline the feature from the high level.
- Search within the provided folder for a `phases` or `plans` sub-folder, and look for clear phased step-by-step implementation plan documents to review. If found, read them.
- If no `phases` or `plans` folder and no `PRD` or `STATUS` documents are found, stop and ask the user to provide the location of the planning documents or confirm the folder to search before proceeding.
- Identify the next phase whose status is not marked as complete (e.g. not labeled DONE, COMPLETE, or ✅ in the planning document). If no status markers exist, read the implementation plan and compare it against the current codebase to determine what has not yet been implemented.
- If all phases are marked complete or the codebase already reflects every planned step, stop and report to the user that implementation appears complete, listing the phases that were found and their status.
- Proceed to implement only the identified next phase.
- After that phase is complete, re-run the planning review against the same path and identify the next incomplete phase.
- Continue implementing phase after phase until all planning documents are marked complete or the codebase already reflects every planned step.
- If a single step turns out to be too large for one bite, break it out into a new phase or even a new feature within the planning docs. If the step is still within the scope of the current feature, add a new numbered phase to the existing plan document. If the step introduces a distinct new capability or cross-cutting concern, create a new feature folder and PRD document for it.

# As you write the new code, Consider:

- The App has no existing users, and is not deployed live yet: we are still in early development phase.
- We do **not** care about any backwards compatibility in the code, or the data-structures: change anything you want.
- Take time to cleanup old/bad/out-of-date code as you encounter it.
- Code priority during this phase is cleanliness, clarity, extensibility, and maintainability.
- After each phase, finish the end-of-phase checklist before starting the next loop iteration.

## Skill Definitions

- `simplify` skill: invoke the agent command `/simplify` which refactors code for reduced complexity without changing behavior.
- `docs-pass` skill: invoke `/docs-pass` which updates inline code comments and README files to reflect the current implementation.

## End-of-Phase Checklist (complete in order)

1. Run the `simplify` skill and wait for it to complete.
2. Run the `docs-pass` skill and wait for it to complete.
3. If either skill reports an error or failure, stop, do not commit, and report the error output to the user before proceeding.
4. Commit all changes for this phase with a descriptive commit message.

## Loop Rule

- After completing the checklist for one phase, return to the top of the Implement Loop with the same path and the updated planning docs.
- Do not stop after the first phase unless the planning docs are fully complete or the codebase already reflects every planned step.