"""Synthetic contract tests for the licensed material-vapour dataset applier."""

from __future__ import annotations

import json
from typing import Any

import pytest
from psycopg import Connection
from pydantic import ValidationError

from database import transaction
from features.datasets.material_vapor import (
    MaterialVaporPayload,
    apply_material_vapor_payload,
    parse_material_vapor_payload,
)


def _existing_material(conn: Connection[Any]) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO catalog_materials (id, name, category)
        VALUES ('rec-synthetic-material', 'Synthetic material', 'insulation')
        ON CONFLICT (id) DO NOTHING
        """
    )
    row = conn.execute(
        """
        SELECT id, vapor_diffusion_resistance_mu, vapor_sd_equivalent_m
        FROM catalog_materials
        ORDER BY id
        LIMIT 1
        """
    ).fetchone()
    assert row is not None
    return row


def test_payload_requires_unique_ids_and_at_least_one_finite_value() -> None:
    duplicate = {
        "rows": [
            {"catalog_material_id": "rec-synthetic", "vapor_diffusion_resistance_mu": 2},
            {"catalog_material_id": "rec-synthetic", "vapor_sd_equivalent_m": 3},
        ]
    }
    with pytest.raises(ValidationError, match="must be unique"):
        MaterialVaporPayload.model_validate(duplicate)

    with pytest.raises(ValidationError, match="must provide mu or sd"):
        MaterialVaporPayload.model_validate({"rows": [{"catalog_material_id": "rec-synthetic"}]})

    with pytest.raises(ValidationError):
        MaterialVaporPayload.model_validate(
            {
                "rows": [
                    {
                        "catalog_material_id": "rec-synthetic",
                        "vapor_diffusion_resistance_mu": float("inf"),
                    }
                ]
            }
        )


def test_parser_accepts_synthetic_mu_and_sd_rows() -> None:
    payload = parse_material_vapor_payload(
        json.dumps(
            {
                "rows": [
                    {
                        "catalog_material_id": "rec-mu",
                        "vapor_diffusion_resistance_mu": 7.5,
                    },
                    {
                        "catalog_material_id": "rec-sd",
                        "vapor_sd_equivalent_m": 12.25,
                    },
                ]
            }
        ).encode()
    )

    assert [row.catalog_material_id for row in payload.rows] == ["rec-mu", "rec-sd"]


def test_applier_is_idempotent_and_reports_unmatched_rows(clean_catalog_tables: None) -> None:
    missing_id = "rec-intentionally-unmatched"

    with transaction() as conn:
        existing = _existing_material(conn)
        payload = MaterialVaporPayload.model_validate(
            {
                "rows": [
                    {
                        "catalog_material_id": existing["id"],
                        "vapor_diffusion_resistance_mu": 7.5,
                    },
                    {
                        "catalog_material_id": missing_id,
                        "vapor_sd_equivalent_m": 12.25,
                    },
                ]
            }
        )
        first = apply_material_vapor_payload(conn, payload)
        second = apply_material_vapor_payload(conn, payload)
        stored = conn.execute(
            """
            SELECT vapor_diffusion_resistance_mu, vapor_sd_equivalent_m
            FROM catalog_materials
            WHERE id = %(id)s
            """,
            {"id": existing["id"]},
        ).fetchone()

    assert first.matched == 1
    assert first.updated == 1
    assert first.unchanged == 0
    assert first.unmatched == (missing_id,)
    assert second.matched == 1
    assert second.updated == 0
    assert second.unchanged == 1
    assert second.unmatched == (missing_id,)
    assert stored == {
        "vapor_diffusion_resistance_mu": 7.5,
        "vapor_sd_equivalent_m": None,
    }


def test_applier_absolute_write_can_replace_mu_with_sd(clean_catalog_tables: None) -> None:
    with transaction() as conn:
        existing = _existing_material(conn)
        payload = MaterialVaporPayload.model_validate(
            {
                "rows": [
                    {
                        "catalog_material_id": existing["id"],
                        "vapor_sd_equivalent_m": 12.25,
                    }
                ]
            }
        )
        report = apply_material_vapor_payload(conn, payload)
        stored = conn.execute(
            """
            SELECT vapor_diffusion_resistance_mu, vapor_sd_equivalent_m
            FROM catalog_materials
            WHERE id = %(id)s
            """,
            {"id": existing["id"]},
        ).fetchone()

    assert report.matched == 1
    assert report.updated == 1
    assert stored == {
        "vapor_diffusion_resistance_mu": None,
        "vapor_sd_equivalent_m": 12.25,
    }
