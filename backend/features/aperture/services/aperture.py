# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.aperture import Aperture, ApertureElement
from db_entities.app.project import Project
from features.aperture.schemas.aperture import FrameSide
from features.aperture.services.aperture_element import get_aperture_element_by_id
from features.aperture.services.frame import get_frame_by_id
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
    logger.info(f"get_apertures_by_project_bt({bt_number=})")

    project = get_project_by_bt_number(db, bt_number)
    apertures = db.query(Aperture).filter(Aperture.project_id == project.id).order_by(Aperture.name.asc()).all()
    return apertures


def get_aperture_by_id(db: Session, aperture_id: int) -> Aperture:
    """Retrieve an aperture by its DB-ID Number."""
    logger.info(f"get_aperture_by_id({aperture_id=})")

    aperture = db.query(Aperture).filter(Aperture.id == aperture_id).first()
    if not aperture:
        raise ValueError(f"Aperture with ID {aperture_id} not found.")

    return aperture


def get_aperture_by_child_element_id(db: Session, element_id: int) -> Aperture:
    """Retrieve the aperture that contains a specific ApertureElement by its ID."""
    logger.info(f"get_aperture_by_child_element_id({element_id=})")

    element = get_aperture_element_by_id(db, element_id)
    if not element:
        raise ValueError(f"ApertureElement with ID {element_id} not found.")

    aperture = db.query(Aperture).filter(Aperture.id == element.aperture_id).first()
    if not aperture:
        raise ValueError(f"Aperture with ID {element.aperture_id} not found.")

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
    logger.info(f"add_row_to_aperture({aperture_id=}, {row_height_mm=})")

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
    logger.info(f"add_column_to_aperture({aperture_id=}, {column_width_mm=})")

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
    logger.info(f"add_new_aperture_on_project({project.id=})")

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
    logger.info(f"update_aperture_name({aperture_id=}, {new_name=})")

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
        f"update_aperture_column_width({aperture_id=}, {column_index=}, {new_width_mm=})"
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
    logger.info(f"update_aperture_row_height({aperture_id=}, {row_index=}, {new_height_mm=})")

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


def update_aperture_element_frame(db: Session, element_id: int, side: str, frame_id: str) -> Aperture:
    """Update the frame for a specific side of an aperture element.

    Args:
        db: Database session
        element_id: ID of the aperture element to update
        side: Side of the element ('top', 'right', 'bottom', 'left')
        frame_id: ID of the frame to assign

    Returns:
        Updated aperture object

    Raises:
        ValueError: If element, frame not found or invalid side
    """
    logger.info(f"update_aperture_element_frame({element_id=}, {side=}, {frame_id=})")

    try:
        # Validate and normalize the side
        try:
            frame_side = FrameSide(side.lower())
            side_attr = f"frame_{frame_side.value}_id"
        except ValueError:
            raise ValueError(f"Invalid frame side: {side}. Must be one of: {[s.value for s in FrameSide]}")

        # Get the element (this will raise ValueError if not found)
        element = get_aperture_element_by_id(db, element_id)

        # Get the frame to validate it exists (this will raise ValueError if not found)
        frame = get_frame_by_id(db, frame_id)

        # Update the specific frame side on the ELEMENT, not the aperture
        setattr(element, side_attr, frame.id)

        # Commit the changes
        db.commit()

        # Return the parent aperture
        return get_aperture_by_id(db, element.aperture_id)

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating aperture element frame {element_id=} | {side=} | {frame_id=}: {str(e)}")
        raise


def merge_aperture_elements(db: Session, aperture_id: int, element_ids: list[int]) -> Aperture:
    """Merge multiple ApertureElements into a single element that spans their combined area.

    Args:
        db: Database session
        aperture_id: ID of the aperture containing the elements
        element_ids: List of element IDs to merge

    Returns:
        Updated aperture object

    Raises:
        ValueError: If elements don't form a complete rectangle or other validation issues
    """
    logger.info(f"merge_aperture_elements({aperture_id=}, {element_ids=})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)

        if len(element_ids) <= 1:
            logger.warning("Cannot merge fewer than 2 elements")
            return aperture

        # Query all elements to be merged
        elements_to_merge = (
            db.query(ApertureElement)
            .filter(ApertureElement.aperture_id == aperture_id, ApertureElement.id.in_(element_ids))
            .all()
        )

        if len(elements_to_merge) != len(element_ids):
            raise ValueError(
                f"Not all requested elements were found. Found {len(elements_to_merge)} of {len(element_ids)}"
            )

        # Calculate the boundaries of the merged element
        min_row = min(elem.row_number for elem in elements_to_merge)
        min_col = min(elem.column_number for elem in elements_to_merge)
        max_row = max(elem.row_number + elem.row_span - 1 for elem in elements_to_merge)
        max_col = max(elem.column_number + elem.col_span - 1 for elem in elements_to_merge)

        # Check if the selection forms a complete rectangle (no gaps)
        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                # Check if each position in the rectangle is covered by a selected element
                position_covered = any(
                    (e.row_number <= r < e.row_number + e.row_span)
                    and (e.column_number <= c < e.column_number + e.col_span)
                    for e in elements_to_merge
                )

                if not position_covered:
                    raise ValueError(f"Elements do not form a complete rectangle. Gap at position ({r}, {c})")

        # Calculate dimensions of new merged element
        row_span = max_row - min_row + 1
        col_span = max_col - min_col + 1

        # Create a new merged element
        new_element = ApertureElement(
            aperture_id=aperture_id,
            row_number=min_row,
            column_number=min_col,
            row_span=row_span,
            col_span=col_span,
        )

        # Delete the original elements
        for element in elements_to_merge:
            db.delete(element)

        # Add the new merged element
        db.add(new_element)

        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error merging aperture elements for aperture {aperture_id}: {str(e)}")
        raise


def split_aperture_element(db: Session, aperture_id: int, element_id: int) -> Aperture:
    """Split an ApertureElement into multiple elements based on its row_span and col_span."""
    logger.info(f"split_aperture_element({aperture_id=}, {element_id=})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        # TODO: implement splitting logic
        element = (
            db.query(ApertureElement)
            .filter(ApertureElement.id == element_id, ApertureElement.aperture_id == aperture_id)
            .first()
        )
        if not element:
            raise ValueError(f"ApertureElement with ID {element_id} not found in Aperture {aperture_id}")

        # Only split if the Aperture Element has a row_span or col_span > 1
        if element.row_span <= 1 and element.col_span <= 1:
            raise ValueError(f"ApertureElement {element_id} cannot be split as it has no span.")

        # Create new elements based on the current element's position and span
        new_elements = []
        for r in range(element.row_span):
            for c in range(element.col_span):
                new_element = ApertureElement(
                    aperture_id=aperture_id,
                    row_number=element.row_number + r,
                    column_number=element.column_number + c,
                    row_span=1,
                    col_span=1,
                )
                new_elements.append(new_element)
        # Add the new elements to the session
        db.add_all(new_elements)
        db.commit()

        # Delete the original element
        db.delete(element)
        db.commit()

        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting aperture {aperture_id}: {str(e)}")
        raise


def update_aperture_element_name(db: Session, element_id: int, new_name: str) -> Aperture:
    """Update the name of an aperture element by its ID."""
    logger.info(f"update_aperture_element_name({element_id=}, {new_name=})")
    
    try:
        element = get_aperture_element_by_id(db, element_id)
        aperture = get_aperture_by_child_element_id(db, element.id)
        element.name = new_name
        db.commit()
        return aperture
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating aperture element name {element_id=} to {new_name=}: {str(e)}")
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
