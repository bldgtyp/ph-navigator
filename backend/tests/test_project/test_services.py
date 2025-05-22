from sqlalchemy.orm import Session
import pytest
from features.project.services import get_project_by_bt_number, ProjectNotFoundException


@pytest.mark.asyncio
async def test_get_project_by_bt_number_fails_on_empty_database(session: Session):
    """Test that get_project_by_bt_number raises ProjectNotFoundException when no project is found."""

    with pytest.raises(ProjectNotFoundException):
        await get_project_by_bt_number(session, "nonexistent_bt_number")