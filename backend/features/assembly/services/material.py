# -*- Python Version: 3.11 -*-

import logging
from typing import Any

from sqlalchemy.orm import Session

from db_entities.assembly import Material, Segment

logger = logging.getLogger(__name__)


class MaterialNotFoundException(Exception):
    """Custom exception for missing material."""

    def __init__(self, material_id: str):
        logger.error(f"{self.__class__.__name__}: Material {material_id} not found.")
        self.material_id = material_id
        self.message = f"Material(s) not found in the database: {material_id}"
        super().__init__(self.message)

class DeleteNonExistentMaterialException(Exception):
    """Custom exception for attempting to delete a non-existent material."""

    def __init__(self, material_id: str):
        logger.error(f"Attempted to delete non-existent material {material_id}.")
        super().__init__(f"Attempted to delete non-existent material {material_id}.")


class NoMaterialsException(Exception):
    """Custom exception for when no materials are found."""

    def __init__(self, material_type: str):
        logger.error(f"No materials found for type: {material_type}.")
        super().__init__(f"No materials found for type: {material_type}.")


def get_material_by_id(db: Session, material_id: str) -> Material:
    """Get a material by its ID or raise MaterialNotFoundException."""
    logger.info(f"get_material_by_id({material_id=})")

    if material := db.query(Material).filter_by(id=material_id).first():
        return material

    raise MaterialNotFoundException(material_id)


def get_material_by_name(db: Session, material_name: str) -> Material:
    """Get a material by its Name or raise MaterialNotFoundException."""
    logger.info(f"get_material_by_name({material_name=})")

    if db_material := db.query(Material).filter_by(name=material_name).first():
        return db_material

    raise MaterialNotFoundException(material_name)


def get_default_material(db: Session) -> Material:
    """Get the default material from the database or raise NoMaterialsException."""
    logger.info("get_default_material()")
    
    mat = db.query(Material).first()
    if not mat:
        raise NoMaterialsException("any")
    return mat


def create_new_material(
    db: Session,
    id: str,
    name: str,
    category: str,
    argb_color: str | None = None,
    conductivity_w_mk: float | None = None,
    emissivity: float | None = None,
    density_kg_m3: float | None = None,
    specific_heat_j_kgk: float | None = None,
    *args: Any,
    **kwargs: Any,
) -> Material:
    """Add a new material to the database."""
    logger.info(f"Adding new material with name: {name}")

    new_material = Material(
        id=id,
        name=name,
        category=category,
        argb_color=argb_color,
        conductivity_w_mk=conductivity_w_mk,
        emissivity=emissivity,
        density_kg_m3=density_kg_m3,
        specific_heat_j_kgk=specific_heat_j_kgk,
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)

    return new_material


def update_material(
    db: Session,
    id: str,
    name: str,
    category: str,
    argb_color: str | None = None,
    conductivity_w_mk: float | None = None,
    emissivity: float | None = None,
    density_kg_m3: float | None = None,
    specific_heat_j_kgk: float | None = None,
    *args: Any,
    **kwargs: Any,
) -> Material:
    """Update an existing material in the database."""
    logger.info(f"Updating material with ID: {id}")

    material = get_material_by_id(db, id)

    material.name = name
    material.category = category
    material.argb_color = argb_color
    material.conductivity_w_mk = conductivity_w_mk
    material.emissivity = emissivity
    material.density_kg_m3 = density_kg_m3
    material.specific_heat_j_kgk = specific_heat_j_kgk

    db.commit()
    db.refresh(material)

    return material


def add_materials(db: Session, materials: list[Material]) -> tuple[int, int]:
    """Add (or update) materials from AirTable to the database."""
    logger.info(f"add_airtable_material_to_db(db, materials={len(materials)} materials)")

    num_materials_added = 0
    num_materials_updated = 0
    for material in materials:
        try:
            # Try and update an existing material
            update_material(db=db, **material.__dict__)
            num_materials_updated += 1
        except MaterialNotFoundException:
            # If the material doesn't exist, create a new one
            create_new_material(db=db, **material.__dict__)
            num_materials_added += 1

    db.commit()

    return num_materials_updated, num_materials_added


def purge_unused_materials(db: Session) -> None:
    """Remove any of the existing materials which are not used by any of the Segments"""
    logger.info("purge_unused_materials(db)")

    # Get all existing materials
    existing_materials = db.query(Material).all()
    existing_material_ids = {material.id for material in existing_materials}

    # Get all segment material IDs
    segment_material_ids = {segment.material.id for segment in db.query(Segment).all()}

    # Find materials that are not used by any segments
    unused_material_ids = existing_material_ids - segment_material_ids

    # Delete unused materials
    for material_id in unused_material_ids:
        try:
            material = get_material_by_id(db, material_id)
            db.delete(material)
            logger.info(f"Deleted unused material with ID: {material_id}")
        except MaterialNotFoundException:
            raise DeleteNonExistentMaterialException(material_id)

    db.commit()
