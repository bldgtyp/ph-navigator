---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Freeze summary contract and routing registry before feature implementation.
RELATED: ../PRD.md; ../research.md
---

# Phase 00 — Contract and Registry

## Goal

Create failing contract tests for the summary response, exact 12-table coverage, status normalization, source isolation, and row destinations.

## Work

- Define compact response models: source/version metadata, totals, groups, leaves, and projected records.
- Establish fallback label and Unknown-state behavior.
- Create a registry derived from or drift-tested against `STATUS_TABLE_NAMES`.
- Record exact frontend destination builders for all 12 tables.
- Add fixture cases for empty, small, large, invalid legacy, and mixed Heat Pump data.

## Exit gate

Tests fail for the missing endpoint but conclusively encode table coverage and semantics; no UI implementation yet.

## Completion evidence

- Added strict Pydantic response contracts and the ordered 12-table summary registry.
- Added a module/test drift guard against `STATUS_TABLE_NAMES` and destination-family coverage.
- `uv run pytest tests/test_project_status_summary.py -q`: `4 passed, 1 failed`; the sole expected red test is the Phase 01 route contract (`404`, expected `200`).
- `uv run ruff check ...` and `uv run ty check ...`: passed.
- Simplify: registry factories removed positional string sprawl; the full product order is asserted; reuse and efficiency reviews were clean.
- Docs-pass: feature STATUS/phase evidence updated; durable context docs intentionally wait for the implemented Phase 01 contract.
