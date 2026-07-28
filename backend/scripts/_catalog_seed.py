"""Shared CLI workflow for deterministic local catalog seeds."""

from __future__ import annotations

import argparse
import pathlib
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import Request

from features.auth.models import UserPublic
from features.auth.service import create_or_update_user
from scripts._catalog_seed_ids import load_catalog_seed
from scripts._seed_paths import assert_local_dev_database, default_user_kwargs


class _PreviewCounts(Protocol):
    @property
    def new(self) -> int: ...

    @property
    def matched(self) -> int: ...

    @property
    def errored(self) -> int: ...

    @property
    def warnings(self) -> int: ...


class _PreviewIssue(Protocol):
    @property
    def reason(self) -> str: ...

    @property
    def row_indices(self) -> Sequence[int]: ...


class _PreviewResult(Protocol):
    @property
    def token(self) -> str: ...

    @property
    def counts(self) -> _PreviewCounts: ...

    @property
    def warnings(self) -> Sequence[_PreviewIssue]: ...

    @property
    def errors(self) -> Sequence[_PreviewIssue]: ...


class _CommitResult(Protocol):
    @property
    def inserted(self) -> int: ...

    @property
    def skipped_conflict_ids(self) -> Sequence[str]: ...


PreviewImport = Callable[[dict[str, Any], UserPublic], _PreviewResult]
CommitImport = Callable[[str, UserPublic, Request], _CommitResult]


@dataclass(frozen=True)
class CatalogSeedSpec:
    """Catalog-specific dependencies for the shared seed workflow."""

    description: str
    default_seed_path: pathlib.Path
    request_path: str
    user_agent: str
    preview_import: PreviewImport
    commit_import: CommitImport


def _fake_request(spec: CatalogSeedSpec) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": spec.request_path,
        "headers": [(b"user-agent", spec.user_agent.encode())],
        "client": ("127.0.0.1", 0),
        "query_string": b"",
    }
    return Request(scope)


def run_catalog_seed(spec: CatalogSeedSpec) -> None:
    """Validate, preview, and insert missing rows from one local catalog seed."""
    defaults = default_user_kwargs()
    parser = argparse.ArgumentParser(description=spec.description)
    parser.add_argument("--seed", type=pathlib.Path, default=spec.default_seed_path)
    parser.add_argument("--email", default=defaults["email"])
    parser.add_argument("--display-name", default=defaults["display_name"])
    parser.add_argument("--password", default=defaults["password"])
    args = parser.parse_args()

    assert_local_dev_database()

    if not args.seed.is_file():
        print(f"Seed file not found: {args.seed}", file=sys.stderr)
        raise SystemExit(2)

    payload = load_catalog_seed(args.seed)
    user = create_or_update_user(
        email=args.email,
        display_name=args.display_name,
        password=args.password,
    )
    preview = spec.preview_import(payload, user)
    print(
        f"Preview: new={preview.counts.new} matched={preview.counts.matched} "
        f"errored={preview.counts.errored} warnings={preview.counts.warnings}"
    )
    for warning in preview.warnings:
        print(f"  warning {warning.reason} on rows {warning.row_indices[:5]}")
    for error in preview.errors:
        print(f"  error {error.reason} on rows {error.row_indices[:5]}")

    if preview.counts.new == 0:
        print(f"No rows to insert: matched={preview.counts.matched} errored={preview.counts.errored}; commit skipped.")
        return

    commit = spec.commit_import(preview.token, user, _fake_request(spec))
    print(f"Committed: inserted={commit.inserted} skipped_conflict={len(commit.skipped_conflict_ids)}")
