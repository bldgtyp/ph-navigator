"""add the membrane material category and the air-permeance column

Revision ID: 20260726_0009
Revises: 20260717_0008
Create Date: 2026-07-26 12:00:00.000000

Both changes are additive and leave every existing row untouched:

* widening the category CHECK to include ``membrane`` (drop + re-add) only
  admits a new value, so no row can be invalidated by it;
* ``air_permeance_l_s_m2_at_75pa`` is a nullable column, so existing rows
  read back as "not recorded" rather than "zero".

Air permeance is stored in the ASTM E2178 reporting unit — L/(s·m²) at 75 Pa —
because that is the figure printed on WRB and air-barrier datasheets and the
one the air-barrier material criterion (≤ 0.02) is written against.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260726_0009"
down_revision: str | None = "20260717_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSTRAINT = "ck_catalog_materials_category"

_CATEGORIES_WITH_MEMBRANE = (
    "insulation",
    "finishes",
    "woods",
    "metals",
    "masonry",
    "stud_layers_steel",
    "stud_layers_wood",
    "air_horizontal_heat_flow",
    "air_upward_heat_flow",
    "air_downward_heat_flow",
    "rainscreen_insulation",
    "doors",
    "membrane",
)

_CATEGORIES_WITHOUT_MEMBRANE = tuple(c for c in _CATEGORIES_WITH_MEMBRANE if c != "membrane")


def _category_check(categories: tuple[str, ...]) -> str:
    values = ", ".join(f"'{category}'::text" for category in categories)
    return f"CHECK ((category = ANY (ARRAY[{values}])))"


def upgrade() -> None:
    op.execute(f"ALTER TABLE catalog_materials DROP CONSTRAINT {_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE catalog_materials ADD CONSTRAINT {_CONSTRAINT} {_category_check(_CATEGORIES_WITH_MEMBRANE)}"
    )
    op.execute("ALTER TABLE catalog_materials ADD COLUMN air_permeance_l_s_m2_at_75pa double precision")
    op.execute(
        """
        ALTER TABLE catalog_materials
        ADD CONSTRAINT ck_catalog_materials_air_permeance_non_negative
        CHECK (air_permeance_l_s_m2_at_75pa IS NULL OR air_permeance_l_s_m2_at_75pa >= 0)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE catalog_materials DROP CONSTRAINT ck_catalog_materials_air_permeance_non_negative")
    op.execute("ALTER TABLE catalog_materials DROP COLUMN air_permeance_l_s_m2_at_75pa")
    # Membrane rows would violate the narrowed constraint; park them under
    # `finishes` rather than fail the downgrade on live data.
    op.execute("UPDATE catalog_materials SET category = 'finishes' WHERE category = 'membrane'")
    op.execute(f"ALTER TABLE catalog_materials DROP CONSTRAINT {_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE catalog_materials ADD CONSTRAINT {_CONSTRAINT} {_category_check(_CATEGORIES_WITHOUT_MEMBRANE)}"
    )
