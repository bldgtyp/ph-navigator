# -*- Python Version: 3.11 (Render.com) -*

import logging
from collections import OrderedDict

from honeybee.typing import clean_ep_string, clean_and_id_ep_string
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy_ph.properties.materials.opaque import EnergyMaterialPhProperties, PhColor, PhDivisionGrid
from honeybee_energy_ref.document_ref import DocumentReference
from honeybee_energy_ref.image_ref import ImageReference
from honeybee_energy_ref.properties.hb_obj import _HBObjectWithReferences

from db_entities.assembly import Layer, Material, Segment
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto

logger = logging.getLogger(__name__)


def convert_MaterialDatasheet_to_hbe_ref(material_datasheet: MaterialDatasheet) -> DocumentReference:
    """Convert a MaterialDatasheet to a Honeybee-Energy Document-Reference."""
    logger.info(f"convert_MaterialDatasheet_to_hbe_ref({material_datasheet.id=})")

    return DocumentReference(
        document_uri=material_datasheet.full_size_url,
        thumbnail_image_uri=material_datasheet.thumbnail_url,
        full_size_image_uri=material_datasheet.full_size_url,
    )


def convert_MaterialPhoto_to_hbe_ref(material_photo: MaterialPhoto) -> ImageReference:
    """Convert a MaterialDatasheet to a Honeybee-Energy Image-Reference."""
    logger.info(f"convert_MaterialPhoto_to_hbe_ref({material_photo.id=})")

    return ImageReference(
        thumbnail_image_uri=material_photo.thumbnail_url,
        full_size_image_uri=material_photo.full_size_url,
    )


def get_PhColor_from_material(material: Material) -> PhColor | None:
    """Get a PhColor from a material's ARGB color."""
    logger.info(f"get_PhColor_from_material({material.id=})")

    if not material.argb_color:
        return None

    ph_color = PhColor()
    ph_color.a = material.color_a
    ph_color.r = material.color_r
    ph_color.g = material.color_g
    ph_color.b = material.color_b

    return ph_color


def get_material_name_from_segment(material: Material, thickness_m: float) -> str:
    """Get a material name from a segment's material and thickness."""
    logger.info(f"get_material_name_from_segment({material.id=}, {thickness_m=})")

    return f"{clean_ep_string(material.name)} [{thickness_m * 39.3701 : .1f} in]"


def convert_segment_material_to_hb_material(segment: Segment, thickness_m: float) -> EnergyMaterial:
    """Convert a segment material to a Honeybee-Energy-Material."""
    logger.info(f"convert_segment_material_to_hb_material({segment.id=})")

    mat = EnergyMaterial(
        identifier=get_material_name_from_segment(segment.material, thickness_m),
        thickness=thickness_m,
        conductivity=segment.material.conductivity_w_mk,
        density=segment.material.density_kg_m3,
        specific_heat=segment.material.specific_heat_j_kgk,
    )
    # -- Set any 'PH' attributes
    hbe_prop_ph: EnergyMaterialPhProperties | None
    if hbe_prop_ph := getattr(mat.properties, "ph", None):
        hbe_prop_ph.ph_color = get_PhColor_from_material(segment.material)

    # -- Set any 'Ref' attributes
    hbe_prop_ref: _HBObjectWithReferences | None
    if hbe_prop_ref := getattr(mat.properties, "ref", None):

        hbe_prop_ref.unlock()
        for d in segment.material_datasheets:
            hbe_prop_ref.add_document_ref(convert_MaterialDatasheet_to_hbe_ref(d))

        for p in segment.material_photos:
            hbe_prop_ref.add_image_ref(convert_MaterialPhoto_to_hbe_ref(p))

        hbe_prop_ref.add_external_identifier("ph_nav", segment.material.id)
        hbe_prop_ref.ref_status = segment.specification_status.value
        hbe_prop_ref.lock()

    return mat


def build_ph_division_grid_from_segments(segments: list[Segment], layer_thickness_m: float) -> PhDivisionGrid:
    """Build a Honeybee-Energy-PH PhDivisionGrid from a list of Segments."""
    logger.info(f"build_ph_division_grid_from_segments([{len(segments)}] segments)")

    division_grid = PhDivisionGrid()
    division_grid.set_row_heights([1.0])
    division_grid.set_column_widths([segment.width_mm / 1000 for segment in segments])

    for i, segment in enumerate(segments):
        hbe_mat = convert_segment_material_to_hb_material(segment, layer_thickness_m)
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
    new_material_.display_name = create_hybrid_hbe_material_name(division_grid)
    new_material_.identifier = clean_and_id_ep_string('HybridEnergyMaterial')
    new_material_.conductivity = division_grid.get_equivalent_conductivity()
    # TODO: eq density
    # TODO: eq spec-heat
    hbph_props = getattr(new_material_.properties, "ph")  # type: EnergyMaterialPhProperties
    hbph_props.divisions = division_grid
    hbph_props.ph_color = getattr(base_material.properties, "ph").ph_color
    return new_material_


def convert_single_assembly_layer_to_hb_material(layer: Layer) -> EnergyMaterial:
    """Convert an assembly layer to a Honeybee-Energy EnergyMaterial."""
    logger.info(f"convert_assembly_layer_to_hb_material(layer.id={layer.id})")

    if len(layer.segments) > 1:
        # If the layer has multiple segments, create a hybrid material
        division_grid = build_ph_division_grid_from_segments(layer.segments, layer.thickness_mm / 1000)
        hbe_material_ = create_hybrid_hbe_material(division_grid)
    else:
        # If the layer has a single segment, convert it directly
        hbe_material_ = convert_segment_material_to_hb_material(layer.segments[0], layer.thickness_mm / 1000)
    return hbe_material_


def convert_multiple_assembly_layers_to_hb_material(_layers: list[Layer]) -> list[EnergyMaterial]:
    """Convert multiple assembly layers into a list of Honeybee-Energy EnergyMaterials."""
    logger.info(f"convert_multiple_assembly_layers_to_hb_material([{len(_layers)}] layers)")

    hbe_materials_: list[EnergyMaterial] = []
    for layer in _layers:
        hbe_materials_.append(convert_single_assembly_layer_to_hb_material(layer))
    return hbe_materials_
