"""Typed payload and idempotent applier for the licensed material-vapour seed."""

from __future__ import annotations

import json
from typing import Any

from psycopg import Connection
from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.datasets.models import ApplyReport


class MaterialVaporRow(BaseModel):
    """Absolute vapour-property values for one stable catalog material id."""

    model_config = ConfigDict(extra="forbid")

    catalog_material_id: str = Field(min_length=1)
    vapor_diffusion_resistance_mu: float | None = Field(default=None, ge=1, allow_inf_nan=False)
    vapor_sd_equivalent_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def _has_vapor_value(self) -> MaterialVaporRow:
        if self.vapor_diffusion_resistance_mu is None and self.vapor_sd_equivalent_m is None:
            raise ValueError("each material-vapour row must provide mu or sd")
        return self


class MaterialVaporPayload(BaseModel):
    """Published shape for the ``iso10456-vapor-mu`` dataset."""

    model_config = ConfigDict(extra="forbid")

    rows: tuple[MaterialVaporRow, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _has_unique_catalog_ids(self) -> MaterialVaporPayload:
        ids = [row.catalog_material_id for row in self.rows]
        if len(ids) != len(set(ids)):
            raise ValueError("catalog_material_id values must be unique")
        return self


def parse_material_vapor_payload(payload: bytes) -> MaterialVaporPayload:
    """Validate a published material-vapour payload without logging its values."""
    return MaterialVaporPayload.model_validate_json(payload)


def apply_material_vapor_payload(
    conn: Connection[Any],
    payload: object,
) -> ApplyReport:
    """Write absolute vapour values in one statement and report missing rows."""
    if not isinstance(payload, MaterialVaporPayload):
        raise TypeError("material-vapour applier requires MaterialVaporPayload")

    rows_json = json.dumps(
        [row.model_dump(mode="json") for row in payload.rows],
        separators=(",", ":"),
    )
    report = conn.execute(
        """
        WITH target AS (
            SELECT
                value->>'catalog_material_id' AS catalog_material_id,
                (value->>'vapor_diffusion_resistance_mu')::double precision
                    AS vapor_diffusion_resistance_mu,
                (value->>'vapor_sd_equivalent_m')::double precision
                    AS vapor_sd_equivalent_m,
                ordinality
            FROM jsonb_array_elements(%(rows)s::jsonb)
                WITH ORDINALITY AS items(value, ordinality)
        ),
        matched AS MATERIALIZED (
            SELECT target.*
            FROM target
            JOIN catalog_materials
              ON catalog_materials.id = target.catalog_material_id
        ),
        updated AS (
            UPDATE catalog_materials
            SET
                vapor_diffusion_resistance_mu =
                    matched.vapor_diffusion_resistance_mu,
                vapor_sd_equivalent_m = matched.vapor_sd_equivalent_m,
                updated_at = now()
            FROM matched
            WHERE catalog_materials.id = matched.catalog_material_id
              AND (
                    catalog_materials.vapor_diffusion_resistance_mu,
                    catalog_materials.vapor_sd_equivalent_m
                  ) IS DISTINCT FROM (
                    matched.vapor_diffusion_resistance_mu,
                    matched.vapor_sd_equivalent_m
                  )
            RETURNING catalog_materials.id
        )
        SELECT
            (SELECT count(*) FROM matched)::integer AS matched,
            (SELECT count(*) FROM updated)::integer AS updated,
            ARRAY(
                SELECT target.catalog_material_id
                FROM target
                LEFT JOIN matched USING (catalog_material_id)
                WHERE matched.catalog_material_id IS NULL
                ORDER BY target.ordinality
            ) AS unmatched
        """,
        {"rows": rows_json},
    ).fetchone()
    if report is None:
        raise RuntimeError("material-vapour applier returned no report")

    matched = report["matched"]
    updated = report["updated"]
    return ApplyReport(
        matched=matched,
        updated=updated,
        unchanged=matched - updated,
        unmatched=tuple(report["unmatched"]),
    )
