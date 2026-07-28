"""CLI behavior shared by the three canonical catalog seeders."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from dataclasses import dataclass
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest
from fastapi import Request

from features.auth.models import UserPublic
from scripts import _catalog_seed as catalog_seed
from scripts import seed_frame_catalog, seed_glazing_catalog, seed_materials_catalog
from scripts._catalog_seed import CatalogSeedSpec


@pytest.mark.parametrize(
    ("seed_module", "spec"),
    [
        (seed_materials_catalog, seed_materials_catalog.SEED_SPEC),
        (seed_frame_catalog, seed_frame_catalog.SEED_SPEC),
        (seed_glazing_catalog, seed_glazing_catalog.SEED_SPEC),
    ],
)
def test_catalog_seed_entrypoint_delegates_to_shared_runner(
    monkeypatch: pytest.MonkeyPatch,
    seed_module: ModuleType,
    spec: CatalogSeedSpec,
) -> None:
    calls: list[CatalogSeedSpec] = []
    monkeypatch.setattr(seed_module, "run_catalog_seed", calls.append)

    seed_module.main()

    assert calls == [spec]


@dataclass(frozen=True)
class _Counts:
    new: int
    matched: int
    errored: int
    warnings: int


@dataclass(frozen=True)
class _Preview:
    token: str
    counts: _Counts
    warnings: Sequence[SimpleNamespace]
    errors: Sequence[SimpleNamespace]


@dataclass(frozen=True)
class _Commit:
    inserted: int
    skipped_conflict_ids: Sequence[str]


def test_shared_seed_runner_reports_matched_noop_without_commit(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    matched = 408
    loaded_paths: list[object] = []

    def preview_import(_payload: dict[str, Any], _user: UserPublic) -> _Preview:
        return _Preview(
            token="unused",
            counts=_Counts(new=0, matched=matched, errored=0, warnings=0),
            warnings=(),
            errors=(),
        )

    def commit_import(_token: str, _user: UserPublic, _request: Request) -> _Commit:
        pytest.fail("A no-op preview must not be committed.")

    spec = CatalogSeedSpec(
        description="Test catalog seed.",
        default_seed_path=seed_materials_catalog.DEFAULT_SEED_PATH,
        request_path="/scripts/test_catalog_seed",
        user_agent="test-catalog-seed",
        preview_import=preview_import,
        commit_import=commit_import,
    )
    monkeypatch.setattr(catalog_seed, "assert_local_dev_database", lambda: None)
    monkeypatch.setattr(
        catalog_seed,
        "load_catalog_seed",
        lambda path: loaded_paths.append(path) or {},
    )
    monkeypatch.setattr(
        catalog_seed,
        "create_or_update_user",
        lambda **_kwargs: SimpleNamespace(),
    )
    monkeypatch.setattr(sys, "argv", ["test_catalog_seed"])

    catalog_seed.run_catalog_seed(spec)

    assert loaded_paths == [spec.default_seed_path]
    assert (
        f"Preview: new=0 matched={matched} errored=0 warnings=0\n"
        f"No rows to insert: matched={matched} errored=0; commit skipped."
    ) in capsys.readouterr().out
