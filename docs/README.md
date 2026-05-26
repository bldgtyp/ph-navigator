# `docs/` — Planning, Reviews, And Archives

- `plans/<YYYY-MM-DD>/...` — transient planning, phasing, and
  implementation notes. Add `DATE` and `TIME` headers.
- `features/...` — feature-focused PRDs that are more durable than
  dated plans but not part of the default `context/` startup set.
  Use these as coding-agent reference documents when implementing
  the corresponding feature cluster.
- `code-reviews/<YYYY-MM-DD>/...` — dated review artifacts and their
  supporting screenshots / contact sheets.
- `REMOVED.md` — routing note for planning docs removed from active
  context.

Stable product, architecture, UI, stack, table, and glossary reference
docs live in `context/`. If a doc should be loaded as durable project
context after the work is complete, move it to `context/`; otherwise
leave it in `docs/features/`, `docs/plans/`, or `docs/code-reviews/` as
appropriate.
