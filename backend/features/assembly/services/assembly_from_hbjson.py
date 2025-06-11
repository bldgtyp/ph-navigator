# -*- Python Version: 3.11 (Render.com) -*

import logging

from honeybee import dictutil as hb_dict_util
from honeybee_energy import dictutil as energy_dict_util
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy_ph.properties.materials.opaque import EnergyMaterialPhProperties
from honeybee_energy_ref.properties.hb_obj import _HBObjectWithReferences
from sqlalchemy.orm import Session

from db_entities.app import Project
from db_entities.assembly import Assembly, Layer, Material, Segment
from features.assembly.services.material import MaterialNotFoundException, get_material_by_id, get_material_by_name

logger = logging.getLogger(__name__)


def get_single_hb_construction_from_hbjson(data: dict) -> OpaqueConstruction | None:
    """De-serialize a single HB OpaqueConstruction from HB-JSON data."""
    logger.info(f"get_single_hb_construction_from_hbjson(data={data['type']}...)")

    hb_objs = hb_dict_util.dict_to_object(data, False)

    if hb_objs is None:  # try to re-serialize it as an energy object
        hb_objs = energy_dict_util.dict_to_object(data, False)

    if not isinstance(hb_objs, OpaqueConstruction):
        logger.warning(f"HB-Object provided of type: {type(hb_objs)} is not construction. Ignoring.")
        return None

    return hb_objs


def get_hb_constructions_from_hbjson(data: dict) -> list[OpaqueConstruction]:
    """De-serialize a list of HB OpaqueConstructions from HB-JSON data."""
    logger.info("get_hb_constructions_from_hbjson(data=...)")

    hb_objs = []
    if "type" in data:
        # Is a single object
        if hb_const := get_single_hb_construction_from_hbjson(data):
            hb_objs.append(hb_const)

    else:
        # no 'type' key means it must be a group of objects
        for hb_dict in data.values():
            if hb_const := get_single_hb_construction_from_hbjson(hb_dict):
                hb_objs.append(hb_const)

    return hb_objs


def get_hb_material_ref_identifier(hb_material: EnergyMaterial) -> str | None:
    """Pull out the Honeybee Material's External-Reference-Identifier, if it has one."""
    logger.info(f"get_hb_material_ref_identifier(hb_material={hb_material.display_name})")

    hb_prop_ref: _HBObjectWithReferences | None = getattr(hb_material.properties, "ref", None)
    if not hb_prop_ref:
        return None
    return hb_prop_ref.get_external_identifier("ph_nav")


def stage_create_segment_from_hb_material(
    db: Session,
    hb_material: EnergyMaterial,
    stl_stud_spacing_mm: float | None,
    segment_width_mm: float,
) -> Segment:
    """Create a Layer Segment from a Honeybee EnergyMaterial.

    Note: Changes are staged but NOT committed. Caller must commit.
    """
    logger.info(f"stage_create_segment_from_hb_material({hb_material.display_name=}, {stl_stud_spacing_mm=})")

    # ------------------------------------------------------------------------------------------------------------------
    # -- Find the Material in the database
    if hb_material_ref_id := get_hb_material_ref_identifier(hb_material):
        # First, try and get the Material by it's ref-id.
        db_material = get_material_by_id(db, hb_material_ref_id)
    else:
        # Get the Segment-Material from the database
        db_material = get_material_by_name(db, hb_material.display_name)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Create a new Segment object
    new_segment = Segment(
        order=0,
        width_mm=segment_width_mm,
    )
    new_segment.material = db_material
    new_segment.steel_stud_spacing_mm = stl_stud_spacing_mm

    # ------------------------------------------------------------------------------------------------------------------
    # -- Add the Segment to the database, but do not commit yet
    db.add(new_segment)
    return new_segment


def get_material_ph_props(hb_material: EnergyMaterial) -> EnergyMaterialPhProperties:
    """Get the EnergyMaterialPhProperties from a Honeybee EnergyMaterial."""

    ph_props: EnergyMaterialPhProperties = getattr(hb_material.properties, "ph")
    if ph_props.divisions.row_count > 1:
        msg = f"Material '{hb_material.display_name}' has more than 1 row of Materials. This is not supported yet."
        raise NotImplementedError(msg)

    return ph_props


def stage_create_layer_from_hb_material(db: Session, hb_material: EnergyMaterial, layer_width_mm: float) -> Layer:
    """Create a new Assembly-Layer from a Honeybee EnergyMaterial.

    Note: Changes are staged but NOT committed. Caller must commit.
    """
    logger.info(f"stage_create_layer_from_hb_material({hb_material.display_name=})")

    segments: list[Segment] = []

    # -- Create the new Layer Segment(s)
    ph_props = get_material_ph_props(hb_material)
    if ph_props.divisions.cell_count > 0 and ph_props.divisions.is_a_steel_stud_cavity:
        # --------------------------------------------------------------------------------------------------------------
        # -- Handle a Steel Stud Layer
        segments.append(
            stage_create_segment_from_hb_material(
                db=db,
                hb_material=ph_props.divisions.cells[0].material,
                stl_stud_spacing_mm=ph_props.divisions.steel_stud_spacing_mm,
                segment_width_mm=layer_width_mm,
            )
        )
    elif ph_props.divisions.cell_count > 0 and not ph_props.divisions.is_a_steel_stud_cavity:
        # --------------------------------------------------------------------------------------------------------------
        # -- Handle Typical heterogeneous layer
        for cell in ph_props.divisions.cells:
            segments.append(
                stage_create_segment_from_hb_material(
                    db=db,
                    hb_material=cell.material,
                    stl_stud_spacing_mm=None,
                    segment_width_mm=ph_props.divisions.get_cell_width_m(cell) * 1000,
                )
            )
    else:
        # --------------------------------------------------------------------------------------------------------------
        # -- Create a new Segment from the Honeybee EnergyMaterial
        segments.append(
            stage_create_segment_from_hb_material(
                db=db, hb_material=hb_material, stl_stud_spacing_mm=None, segment_width_mm=layer_width_mm
            )
        )

    # ------------------------------------------------------------------------------------------------------------------
    # -- Create a new Layer object with Segments
    new_layer = Layer(
        order=0,
        thickness_mm=hb_material.thickness * 1000,
        segments=[],
    )
    for new_segment in segments:
        new_layer.segments.append(new_segment)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Add the new Layer to the database, but do not commit yet
    db.add(new_layer)
    return new_layer


def find_maximum_assembly_width(hb_materials: list[EnergyMaterial]) -> float:
    """Find the maximum assembly width (mm) considering all the segments."""
    logger.info(f"find_maximum_assembly_width(hb_materials=[{len(hb_materials)}])")

    material_widths = [
        812.8,
    ]  # 16 inches default for assemblies
    for hb_material in hb_materials:
        ph_props = get_material_ph_props(hb_material)
        for cell in ph_props.divisions.cells:
            material_widths.append(ph_props.divisions.get_cell_width_m(cell) * 1000)
    return max(material_widths)


def create_assembly_from_hb_construction(
    db: Session, bt_number: str, hb_opaque_construction: OpaqueConstruction
) -> Assembly:
    """Create an AssemblySchema from a Honeybee OpaqueConstruction."""
    logger.info(f"create_assembly_from_hb_construction({hb_opaque_construction.display_name=})")

    # ------------------------------------------------------------------------------------------------------------------
    # -- Check if the project exists
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise ValueError(f"Project with id {bt_number} not found in database.")

    # ------------------------------------------------------------------------------------------------------------------
    # -- Get or Create the Assembly
    if (
        assembly := db.query(Assembly)
        .filter_by(name=hb_opaque_construction.display_name, project_id=project.id)
        .first()
    ):
        logger.info(f"Assembly with name '{assembly.name}' already exists for project '{project.id}'. Updating.")
    else:
        logger.info(
            f"Creating new Assembly with name '{hb_opaque_construction.display_name}' for project {project.id}."
        )
        assembly = Assembly(
            name=hb_opaque_construction.display_name,
            project=project,
            layers=[],
        )
        db.add(assembly)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Get just the EnergyMaterials from the OpaqueConstruction.
    energy_materials: list[EnergyMaterial] = []
    for hb_mat in hb_opaque_construction.materials:
        if not isinstance(hb_mat, EnergyMaterial):
            logger.warning(
                f"Material {getattr(hb_mat, 'display_name', str(hb_mat))} [{type(hb_mat)=}] is not an EnergyMaterial. Ignoring."
            )
            continue
        energy_materials.append(hb_mat)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Figure out the total Assembly width for the layers (considering the segment widths)
    assembly_width_mm = find_maximum_assembly_width(energy_materials)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Build up all of the new Layers and Segments
    new_layers = []
    missing_materials = []

    for hb_mat in energy_materials:
        try:
            mat = stage_create_layer_from_hb_material(db, hb_mat, assembly_width_mm)
        except MaterialNotFoundException as e:
            # Collect missing materials
            logger.warning(f"{e.__class__.__name__}, {e.message}")
            missing_materials.append(e.material_id)
        except Exception as e:
            # Log and re-raise other exceptions
            logger.error(f"Unexpected error creating layer: {str(e)}")
            raise

        # --------------------------------------------------------------------------------------------------------------
        # If we found any missing materials, raise a specific exception
        if missing_materials:
            missing_list = ", ".join(missing_materials)
            raise MaterialNotFoundException(f"[{missing_list}]")

        new_layers.append(mat)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Add the new layers to the Assembly
    assembly.remove_all_layers()
    for layer in new_layers:
        assembly.layers.append(layer)

    # ------------------------------------------------------------------------------------------------------------------
    db.commit()
    db.refresh(assembly)

    logger.info(f"Created / Updated Assembly: {assembly.name} with {len(assembly.layers)} layers.")

    return assembly
