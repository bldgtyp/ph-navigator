# `planning/` - Working Plans And Feature State

This folder holds tracked planning material that is useful during
implementation but should not be part of the default startup context.

Read order:

1. `.instructions.md` for folder rules.
2. `STATUS.md` for current feature state.
3. `ROADMAP.html` for the historical tracer-bullet roadmap.
4. `features/<feature>/README.md` and `features/<feature>/STATUS.md`
   for the active feature.

## Layout

- `features/<feature>/` - feature PRDs, phase plans, status ledgers,
  decisions, reviews, research, and assets.
- `code-reviews/<YYYY-MM-DD>/` - dated review artifacts that are not
  feature-local.
- `archive/dated/<YYYY-MM-DD>/` - historical dated plans preserved for
  reference.
- `ROADMAP.html` - active/historical implementation roadmap.

Stable contracts live in `context/`. Local scratch lives in gitignored
`working/`.
