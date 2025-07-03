# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.app.project import Project
from features.app.services import get_project_by_bt_number

logger = logging.getLogger(__name__)


class LastColumnException(Exception):
    """Exception raised when trying to delete the only column in an aperture."""

    def __init__(self, column_number: int, aperture_number: int):
        logger.error(f"Cannot delete Column-{column_number}. It is the last column in Aperture-{aperture_number}.")
        super().__init__(f"Cannot delete Column-{column_number}. It is the last column in Aperture-{aperture_number}.")


class LastRowException(Exception):
    """Exception raised when trying to delete the only row in an aperture."""

    def __init__(self, row_number: int, aperture_number: int):
        logger.error(f"Cannot delete Row-{row_number}. It is the last row in Aperture-{aperture_number}.")
        super().__init__(f"Cannot delete Row-{row_number}. It is the last row in Aperture-{aperture_number}.")


def get_apertures_by_project_bt(db: Session, bt_number: str) -> list[Aperture]:
    """Retrieve all apertures associated with a specific project."""
    logger.info(f"get_apertures_by_project_bt({bt_number})")

    project = get_project_by_bt_number(db, bt_number)
    apertures = db.query(Aperture).filter(Aperture.project_id == project.id).order_by(Aperture.name.asc()).all()
    return apertures


def get_aperture_by_id(db: Session, aperture_id: int) -> Aperture:
    """Retrieve an aperture by its DB-ID Number."""
    logger.info(f"get_aperture_by_id({aperture_id})")

    aperture = db.query(Aperture).filter(Aperture.id == aperture_id).first()
    if not aperture:
        raise ValueError(f"Aperture with ID {aperture_id} not found.")

    return aperture


def add_row_to_aperture(db: Session, aperture_id: int, row_height_mm: float = 100.0) -> Aperture:
    """Add a new row to the aperture grid with specified height.

    Args:
        db: Database session
        aperture_id: ID of the aperture to modify
        row_height: Height of the new row in mm (default: 100.0)

    Returns:
        Updated aperture object

    Raises:
        ValueError: If aperture not found
    """
    logger.info(f"add_row_to_aperture({aperture_id}, row_height_mm={row_height_mm})")

    try:
        # Get the aperture (this will raise ValueError if not found)
        aperture = get_aperture_by_id(db, aperture_id)

        # Calculate the new row index
        new_row_index = len(aperture.row_heights_mm)

        # Create a new list (this will be detected as a change)
        aperture.row_heights_mm = aperture.row_heights_mm + [row_height_mm]

        # Create a new element for each column in the new row
        for col_index in range(len(aperture.column_widths_mm)):
            new_element = ApertureElement(
                aperture=aperture,
                row_number=new_row_index,
                column_number=col_index,
                row_span=1,
                col_span=1,
            )
            db.add(new_element)

        # Commit the transaction
        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding row to aperture {aperture_id}: {str(e)}")
        raise


def add_column_to_aperture(db: Session, aperture_id: int, column_width_mm: float = 100.00) -> Aperture:
    """Add a new column to the aperture grid with specified width.

    Args:
        db: Database session
        aperture_id: ID of the aperture to modify
        column_width_mm: Width of the new column in mm (default: 100.00)

    Returns:
        Updated aperture object

    Raises:
        ValueError: If aperture not found
    """
    logger.info(f"add_column_to_aperture({aperture_id}, column_width_mm={column_width_mm})")

    try:
        # Get the aperture (this will raise ValueError if not found)
        aperture = get_aperture_by_id(db, aperture_id)

        # Calculate the new column index
        new_col_index = len(aperture.column_widths_mm)

        # Create a new list (this will be detected as a change)
        aperture.column_widths_mm = aperture.column_widths_mm + [column_width_mm]

        # Create a new element for each row in the new column
        for row_index in range(len(aperture.row_heights_mm)):
            new_element = ApertureElement(
                aperture=aperture,
                row_number=row_index,
                column_number=new_col_index,
                row_span=1,
                col_span=1,
            )
            db.add(new_element)

        # Commit the transaction
        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding column to aperture {aperture_id}: {str(e)}")
        raise


def delete_row_from_aperture(db: Session, aperture_id: int, row_number: int) -> Aperture:
    """Delete a row from the aperture grid."""
    logger.info(f"delete_row_from_aperture({aperture_id=}, {row_number=})")

    try:
        # Get the aperture (this will raise ValueError if not found)
        aperture = get_aperture_by_id(db, aperture_id)

        # Check if the row number is valid
        if row_number < 0 or row_number >= len(aperture.row_heights_mm):
            raise ValueError(f"Invalid row number {row_number} for aperture {aperture_id}")

        # If this is the last row, raise an exception
        if len(aperture.row_heights_mm) == 1:
            raise LastColumnException(row_number, aperture_id)

        # Remove the row height (Copy array to ensure SQLAlchemy detects the change)
        new_heights = aperture.row_heights_mm.copy()
        new_heights.pop(row_number)
        aperture.row_heights_mm = new_heights

        # Remove all elements in the deleted row
        db.query(ApertureElement).filter(
            ApertureElement.aperture_id == aperture_id, ApertureElement.row_number == row_number
        ).delete()

        # Shift the row-number of any ApertureElements with row-number>the delete target
        db.query(ApertureElement).filter(
            ApertureElement.aperture_id == aperture_id, ApertureElement.row_number > row_number
        ).update({ApertureElement.row_number: ApertureElement.row_number - 1}, synchronize_session=False)

        # Commit the transaction
        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting row from aperture {aperture_id}: {str(e)}")
        raise


def delete_column_from_aperture(db: Session, aperture_id: int, column_number: int) -> Aperture:
    """ "Delete a column from the aperture grid."""
    logger.info(f"delete_column_from_aperture({aperture_id=}, {column_number=})")

    try:
        # Get the aperture (this will raise ValueError if not found)
        aperture = get_aperture_by_id(db, aperture_id)

        # Check if the column number is valid
        if column_number < 0 or column_number >= len(aperture.column_widths_mm):
            raise ValueError(f"Invalid column number {column_number} for aperture {aperture_id}")

        # If this is the last column, raise an exception
        if len(aperture.column_widths_mm) == 1:
            raise LastColumnException(column_number, aperture_id)

        # Remove the column width (Copy array to ensure SQLAlchemy detects the change)
        new_widths = aperture.column_widths_mm.copy()
        new_widths.pop(column_number)
        aperture.column_widths_mm = new_widths

        # Remove all elements in the deleted column
        db.query(ApertureElement).filter(
            ApertureElement.aperture_id == aperture_id, ApertureElement.column_number == column_number
        ).delete()

        # Shift the col-number of any ApertureElements with col-number>the delete target
        db.query(ApertureElement).filter(
            ApertureElement.aperture_id == aperture_id, ApertureElement.column_number > column_number
        ).update({ApertureElement.column_number: ApertureElement.column_number - 1}, synchronize_session=False)

        # Commit the transaction
        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting column from aperture {aperture_id}: {str(e)}")
        raise


def add_new_aperture_on_project(db: Session, project: Project) -> Aperture:
    """Add a new default aperture to the specified project."""
    logger.info(f"add_new_aperture_on_project({project.id})")

    try:
        new_aperture = Aperture.default(project=project)
        db.add(new_aperture)
        db.commit()
        return new_aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding new aperture on project {project.id}: {str(e)}")
        raise


def update_aperture_name(db: Session, aperture_id: int, new_name: str) -> Aperture:
    """Update the name of an existing aperture."""
    logger.info(f"update_aperture_name({aperture_id}, new_name={new_name})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        aperture.name = new_name
        db.commit()
        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating aperture name {aperture_id}: {str(e)}")
        raise


def update_aperture_column_width(db: Session, aperture_id: int, column_index: int, new_width_mm: float) -> Aperture:
    """Update the width of a specific column in an aperture."""
    logger.info(
        f"update_aperture_column_width({aperture_id}, column_index={column_index}, new_width_mm={new_width_mm})"
    )

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        col_widths = aperture.column_widths_mm.copy()
        col_widths[column_index] = new_width_mm
        aperture.column_widths_mm = col_widths
        db.commit()
        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating aperture column width {aperture_id}: {str(e)}")
        raise


def update_aperture_row_height(db: Session, aperture_id: int, row_index: int, new_height_mm: float) -> Aperture:
    """Update the height of a specific row in an aperture."""
    logger.info(f"update_aperture_row_height({aperture_id}, row_index={row_index}, new_height_mm={new_height_mm})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        row_heights = aperture.row_heights_mm.copy()
        row_heights[row_index] = new_height_mm
        aperture.row_heights_mm = row_heights
        db.commit()
        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating aperture row height {aperture_id}: {str(e)}")
        raise


def delete_aperture(db: Session, aperture_id: int) -> None:
    """Delete an aperture and all its elements from the database."""
    logger.info(f"delete_aperture({aperture_id})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        db.delete(aperture)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting aperture {aperture_id}: {str(e)}")
        raise
