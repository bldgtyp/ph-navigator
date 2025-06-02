# -*- Python Version: 3.11 (Render.com) -*

import logging
from collections import OrderedDict

from honeybee.typing import clean_ep_string
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy_ph.properties.materials.opaque import EnergyMaterialPhProperties, PhDivisionGrid

from db_entities.assembly import Layer, Material, Segment

logger = logging.getLogger(__name__)


def convert_segment_material_to_hb_material(segment_material: Material, thickness_m: float) -> EnergyMaterial:
    """Convert a segment material to a Honeybee-Energy-Material."""
    logger.info(f"convert_segment_material_to_hb_material(segment_material={segment_material.name})")

    return EnergyMaterial(
        identifier=clean_ep_string(segment_material.name),
        thickness=thickness_m,
        conductivity=segment_material.conductivity_w_mk,
        density=segment_material.density_kg_m3,
        specific_heat=segment_material.specific_heat_j_kgk,
    )


def build_ph_division_grid_from_segments(segments: list[Segment], layer_thickness_m: float) -> PhDivisionGrid:
    """Build a Honeybee-Energy-PH PhDivisionGrid from a list of Segments."""
    logger.info(f"build_ph_division_grid_from_segments([{len(segments)}] segments)")

    division_grid = PhDivisionGrid()
    division_grid.set_row_heights([1.0])
    division_grid.set_column_widths([segment.width_mm / 1000 for segment in segments])

    for i, segment in enumerate(segments):
        hbe_mat = convert_segment_material_to_hb_material(segment.material, layer_thickness_m)
        division_grid.set_cell_material(_column_num=i, _row_num=0, _hbe_material=hbe_mat)

    return division_grid


def create_hybrid_hbe_material_name(division_grid: PhDivisionGrid) -> str:
    """Create a name for the hybrid material based on the division grid's materials."""
    logger.info(f"create_hybrid_material_name(division_grid={division_grid})")

    unique_mats = OrderedDict()
    for cell in division_grid.cells:
        unique_mats[cell.material.display_name] = cell.material.display_name
    return " + ".join(unique_mats.keys())


def create_hybrid_hbe_material(division_grid: PhDivisionGrid) -> EnergyMaterial:
    """Create a hybrid Honeybee-Energy material from a PhDivisionGrid."""
    logger.info(f"create_hybrid_hbe_material(division_grid={division_grid})")

    base_material = division_grid.get_base_material()
    if not base_material:
        raise ValueError("No base material found in the division grid.")

    new_material_ = base_material.duplicate()
    nm = create_hybrid_hbe_material_name(division_grid)
    new_material_.display_name = nm
    new_material_.identifier = nm
    new_material_.conductivity = division_grid.get_equivalent_conductivity()
    # TODO: eq density
    # TODO: eq spec-heat
    hbph_props = getattr(new_material_.properties, "ph")  # type: EnergyMaterialPhProperties
    hbph_props.divisions = division_grid
    return new_material_


def convert_single_assembly_layer_to_hb_material(
    layer: Layer,
) -> EnergyMaterial:
    """Convert an assembly layer to a Honeybee Energy Material."""
    logger.info(f"convert_assembly_layer_to_hb_material(layer.id={layer.id})")

    division_grid = build_ph_division_grid_from_segments(layer.segments, layer.thickness_mm / 1000)
    hbe_material_ = create_hybrid_hbe_material(division_grid)
    return hbe_material_


def convert_multiple_assembly_layers_to_hb_material(
    _layers: list[Layer],
) -> list[EnergyMaterial]:
    """Convert multiple assembly layers to Honeybee Energy Materials."""
    logger.info(f"convert_multiple_assembly_layers_to_hb_material([{len(_layers)}] layers)")
    
    hbe_materials_: list[EnergyMaterial] = []
    for layer in _layers:
        hbe_materials_.append(convert_single_assembly_layer_to_hb_material(layer))
    return hbe_materials_
