---
name: docs-pass
description: Run at the tail end of a task to decide whether this repo's context docs or Nimbalyst tracker/plan artifacts need a small, material update. Use after implementation, debugging, research, or review work when architecture decisions, next steps, lessons learned, deferred work, or task status may have changed.
---
# Docs Pass

Run this after the main task is complete or nearly complete.

Goal: capture durable, high-signal changes while they are still fresh. Keep the pass small. If nothing important changed, say so and stop.

## 1. Start with the actual delta

- Inspect the task outcome and changed files first.
- Prefer `git diff --stat` plus focused reads of the touched files.
- If the task was mostly investigation or debugging, also use the session notes and test results.

## 2. Decide whether repo docs need an update

Use the existing doc structure in `context/` and keep a single source of truth.

- `context/architecture.md`: update only when an invariant, boundary, or architectural rule changed.
- `context/decisions/000N-*.md`: add or revise an ADR only for a hard-to-reverse decision with real tradeoffs.
- `context/roadmap.md`: update only when slice scope, order, or exit criteria changed.
- `context/next-steps.md`: add open items, deferred items, guards, or a short resolved note when the task changed near-term work.
- `context/lessons-learned/*.md`: update only when the task exposed a non-obvious rule, repeated failure mode, or debugging lesson that will matter again.
- `context/lessons-learned/resolved-log.md`: use only when sweeping older resolved entries out of `next-steps.md`, or when the file is the right long-term home.
- Other docs: touch them only if they are the established source of truth for the fact you learned.

## 3. Be conservative

- Do not restate code changes that are already obvious from the diff.
- Do not duplicate the same fact across multiple docs.
- Do not create TODO churn for speculative ideas.
- Do not write a lessons-learned log for routine fixes.
- Prefer one precise note in the right file over broad cleanup.

## 4. Update Nimbalyst tasks and plans

Check for an existing tracker item, plan, or linked work artifact that matches the task.

- Update the existing item's status, progress, or notes when the work materially changed reality.
- Update the linked plan file when the next slice, open question, or follow-up work changed.
- Prefer updating an existing tracker item over creating a new one.
- Create a new tracker item only when the task exposed a real follow-up that needs durable ownership and no current item fits.
- Never mark items `done` or `completed` unless the user explicitly asked for that. Use `in-review` or `in-progress` when appropriate.

## 5. Close the pass

Report one of these outcomes:

- which docs and Nimbalyst items were updated, and why; or
- that nothing material changed, so no doc/tracker update was needed.

When in doubt, bias toward fewer edits and clearer placement.
