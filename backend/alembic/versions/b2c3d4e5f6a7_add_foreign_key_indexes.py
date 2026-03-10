"""Add foreign key indexes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-22 12:00:00.000000

Performance improvement: Add indexes to all foreign key columns.
PostgreSQL does not automatically create indexes on foreign keys,
which causes slow JOINs and CASCADE operations.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add indexes to all foreign key columns for improved query performance."""

    # Projects table
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_projects_airtable_base_id", "projects", ["airtable_base_id"])

    # Assemblies table
    op.create_index("ix_assemblies_project_id", "assemblies", ["project_id"])

    # Assembly Layers table
    op.create_index(
        "ix_assembly_layers_assembly_id", "assembly_layers", ["assembly_id"]
    )

    # Assembly Layer Segments table
    op.create_index(
        "ix_assembly_layer_segments_layer_id",
        "assembly_layer_segments",
        ["layer_id"],
    )
    op.create_index(
        "ix_assembly_layer_segments_material_id",
        "assembly_layer_segments",
        ["material_id"],
    )

    # Material Photos table
    op.create_index("ix_material_photos_segment_id", "material_photos", ["segment_id"])

    # Material Datasheets table
    op.create_index(
        "ix_material_datasheets_segment_id", "material_datasheets", ["segment_id"]
    )

    # AirTable Tables table
    op.create_index(
        "ix_airtable_tables_parent_base_id", "airtable_tables", ["parent_base_id"]
    )

    # Apertures table
    op.create_index("ix_apertures_project_id", "apertures", ["project_id"])

    # Aperture Elements table
    op.create_index(
        "ix_aperture_elements_aperture_id", "aperture_elements", ["aperture_id"]
    )
    op.create_index(
        "ix_aperture_elements_glazing_id", "aperture_elements", ["glazing_id"]
    )
    op.create_index(
        "ix_aperture_elements_frame_top_id", "aperture_elements", ["frame_top_id"]
    )
    op.create_index(
        "ix_aperture_elements_frame_bottom_id", "aperture_elements", ["frame_bottom_id"]
    )
    op.create_index(
        "ix_aperture_elements_frame_left_id", "aperture_elements", ["frame_left_id"]
    )
    op.create_index(
        "ix_aperture_elements_frame_right_id", "aperture_elements", ["frame_right_id"]
    )

    # Aperture Element Frame table
    op.create_index(
        "ix_aperture_element_frame_frame_type_id",
        "aperture_element_frame",
        ["frame_type_id"],
    )

    # Aperture Element Glazing table
    op.create_index(
        "ix_aperture_element_glazing_glazing_type_id",
        "aperture_element_glazing",
        ["glazing_type_id"],
    )


def downgrade() -> None:
    """Remove all foreign key indexes."""

    # Aperture Element Glazing table
    op.drop_index(
        "ix_aperture_element_glazing_glazing_type_id",
        table_name="aperture_element_glazing",
    )

    # Aperture Element Frame table
    op.drop_index(
        "ix_aperture_element_frame_frame_type_id", table_name="aperture_element_frame"
    )

    # Aperture Elements table
    op.drop_index("ix_aperture_elements_frame_right_id", table_name="aperture_elements")
    op.drop_index("ix_aperture_elements_frame_left_id", table_name="aperture_elements")
    op.drop_index(
        "ix_aperture_elements_frame_bottom_id", table_name="aperture_elements"
    )
    op.drop_index("ix_aperture_elements_frame_top_id", table_name="aperture_elements")
    op.drop_index("ix_aperture_elements_glazing_id", table_name="aperture_elements")
    op.drop_index("ix_aperture_elements_aperture_id", table_name="aperture_elements")

    # Apertures table
    op.drop_index("ix_apertures_project_id", table_name="apertures")

    # AirTable Tables table
    op.drop_index("ix_airtable_tables_parent_base_id", table_name="airtable_tables")

    # Material Datasheets table
    op.drop_index("ix_material_datasheets_segment_id", table_name="material_datasheets")

    # Material Photos table
    op.drop_index("ix_material_photos_segment_id", table_name="material_photos")

    # Assembly Layer Segments table
    op.drop_index(
        "ix_assembly_layer_segments_material_id", table_name="assembly_layer_segments"
    )
    op.drop_index(
        "ix_assembly_layer_segments_layer_id", table_name="assembly_layer_segments"
    )

    # Assembly Layers table
    op.drop_index("ix_assembly_layers_assembly_id", table_name="assembly_layers")

    # Assemblies table
    op.drop_index("ix_assemblies_project_id", table_name="assemblies")

    # Projects table
    op.drop_index("ix_projects_airtable_base_id", table_name="projects")
    op.drop_index("ix_projects_owner_id", table_name="projects")
