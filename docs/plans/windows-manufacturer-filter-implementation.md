# Windows Manufacturer Filter - Step-by-Step Implementation Guide

**Purpose:** This guide provides exact code to implement per-project manufacturer filtering for the Windows/Apertures view. Follow each phase sequentially.

---

## Phase 1: Backend Database Entity

- [x] Completed

### Step 1.1: Create the DB Entity

**Create file:** `backend/db_entities/app/manufacturer_filter.py`

```python
# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    from db_entities.app.project import Project


class ProjectManufacturerFilter(Base):
    """Stores per-project manufacturer filter preferences."""

    __tablename__ = "project_manufacturer_filters"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = MappedColumn(
        Integer, ForeignKey("projects.id"), nullable=False, index=True
    )
    manufacturer: Mapped[str] = MappedColumn(String(255), nullable=False)
    filter_type: Mapped[str] = MappedColumn(String(50), nullable=False)  # 'frame' or 'glazing'
    is_enabled: Mapped[bool] = MappedColumn(Boolean, nullable=False, default=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="manufacturer_filters")
```

### Step 1.2: Update Project Entity

**Modify file:** `backend/db_entities/app/project.py`

Add this import at the top (with existing imports):

```python
from db_entities.app.manufacturer_filter import ProjectManufacturerFilter
```

Add this relationship inside the `Project` class (after the existing `apertures` relationship around line 53):

```python
    manufacturer_filters: Mapped[list["ProjectManufacturerFilter"]] = relationship(
        "ProjectManufacturerFilter",
        back_populates="project",
        cascade="all, delete-orphan",
    )
```

### Step 1.3: Create Alembic Migration

**Create file:** `backend/alembic/versions/xxxx_add_manufacturer_filters.py`

Generate with: `cd backend && alembic revision -m "add_manufacturer_filters"`

Then replace content with:

```python
"""add_manufacturer_filters

Revision ID: <generated_id>
Revises: 003cd631d956
Create Date: <generated_date>

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '<generated_id>'
down_revision: Union[str, None] = '003cd631d956'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'project_manufacturer_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('manufacturer', sa.String(length=255), nullable=False),
        sa.Column('filter_type', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_project_manufacturer_filters_id'),
        'project_manufacturer_filters',
        ['id'],
        unique=False
    )
    op.create_index(
        op.f('ix_project_manufacturer_filters_project_id'),
        'project_manufacturer_filters',
        ['project_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_project_manufacturer_filters_project_id'), table_name='project_manufacturer_filters')
    op.drop_index(op.f('ix_project_manufacturer_filters_id'), table_name='project_manufacturer_filters')
    op.drop_table('project_manufacturer_filters')
```

**Run migration:** `cd backend && alembic upgrade head`

---

## Phase 2: Backend API Routes & Services

- [x] Completed

### Step 2.1: Create Schema

**Create file:** `backend/features/aperture/schemas/manufacturer_filter.py`

```python
# -*- Python Version: 3.11 -*-

from pydantic import BaseModel


class ManufacturerFilterResponseSchema(BaseModel):
    """Response schema for manufacturer filter configuration."""

    available_frame_manufacturers: list[str]
    enabled_frame_manufacturers: list[str]
    available_glazing_manufacturers: list[str]
    enabled_glazing_manufacturers: list[str]


class ManufacturerFilterUpdateSchema(BaseModel):
    """Request schema for updating manufacturer filter configuration."""

    enabled_frame_manufacturers: list[str]
    enabled_glazing_manufacturers: list[str]
```

### Step 2.2: Create Service Layer

**Create file:** `backend/features/aperture/services/manufacturer_filter.py`

```python
# -*- Python Version: 3.11 -*-

import logging
from sqlalchemy.orm import Session
from sqlalchemy import distinct

from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.project import Project
from db_entities.app.manufacturer_filter import ProjectManufacturerFilter

logger = logging.getLogger(__name__)


def get_all_frame_manufacturers(db: Session) -> list[str]:
    """Get all unique frame manufacturers from the database."""
    result = db.query(distinct(ApertureFrameType.manufacturer)).filter(
        ApertureFrameType.manufacturer.isnot(None),
        ApertureFrameType.manufacturer != ""
    ).all()
    return sorted([r[0] for r in result])


def get_all_glazing_manufacturers(db: Session) -> list[str]:
    """Get all unique glazing manufacturers from the database."""
    result = db.query(distinct(ApertureGlazingType.manufacturer)).filter(
        ApertureGlazingType.manufacturer.isnot(None),
        ApertureGlazingType.manufacturer != ""
    ).all()
    return sorted([r[0] for r in result])


def get_project_by_bt_number(db: Session, bt_number: str) -> Project | None:
    """Get project by BT number."""
    return db.query(Project).filter(Project.bt_number == bt_number).first()


def get_enabled_manufacturers(
    db: Session, project_id: int, filter_type: str
) -> list[str]:
    """Get list of enabled manufacturers for a project and filter type."""
    filters = db.query(ProjectManufacturerFilter).filter(
        ProjectManufacturerFilter.project_id == project_id,
        ProjectManufacturerFilter.filter_type == filter_type,
        ProjectManufacturerFilter.is_enabled == True
    ).all()
    return [f.manufacturer for f in filters]


def has_any_filters(db: Session, project_id: int, filter_type: str) -> bool:
    """Check if any filters exist for this project/type (configured vs unconfigured)."""
    count = db.query(ProjectManufacturerFilter).filter(
        ProjectManufacturerFilter.project_id == project_id,
        ProjectManufacturerFilter.filter_type == filter_type
    ).count()
    return count > 0


def update_manufacturer_filters(
    db: Session,
    project_id: int,
    filter_type: str,
    enabled_manufacturers: list[str],
    all_manufacturers: list[str]
) -> None:
    """Update manufacturer filters for a project.

    Creates filter records for all known manufacturers, marking enabled ones.
    """
    # Delete existing filters for this project/type
    db.query(ProjectManufacturerFilter).filter(
        ProjectManufacturerFilter.project_id == project_id,
        ProjectManufacturerFilter.filter_type == filter_type
    ).delete()

    # Create new filter records for all manufacturers
    for manufacturer in all_manufacturers:
        filter_record = ProjectManufacturerFilter(
            project_id=project_id,
            manufacturer=manufacturer,
            filter_type=filter_type,
            is_enabled=manufacturer in enabled_manufacturers
        )
        db.add(filter_record)

    db.commit()
```

### Step 2.3: Create Routes

**Create file:** `backend/features/aperture/routes/manufacturer_filter.py`

```python
# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from features.aperture.schemas.manufacturer_filter import (
    ManufacturerFilterResponseSchema,
    ManufacturerFilterUpdateSchema,
)
from features.aperture.services.manufacturer_filter import (
    get_all_frame_manufacturers,
    get_all_glazing_manufacturers,
    get_project_by_bt_number,
    get_enabled_manufacturers,
    has_any_filters,
    update_manufacturer_filters,
)

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get(
    "/manufacturer-filters/{bt_number}",
    response_model=ManufacturerFilterResponseSchema
)
def get_manufacturer_filters_route(
    bt_number: str,
    db: Session = Depends(get_db),
) -> ManufacturerFilterResponseSchema:
    """Get manufacturer filter configuration for a project."""
    logger.info(f"aperture/get_manufacturer_filters_route({bt_number})")

    project = get_project_by_bt_number(db, bt_number)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {bt_number} not found")

    # Get all available manufacturers
    all_frame_manufacturers = get_all_frame_manufacturers(db)
    all_glazing_manufacturers = get_all_glazing_manufacturers(db)

    # Get enabled manufacturers (if filters configured)
    # If no filters configured, all are enabled (backwards compatible)
    if has_any_filters(db, project.id, "frame"):
        enabled_frame = get_enabled_manufacturers(db, project.id, "frame")
    else:
        enabled_frame = all_frame_manufacturers

    if has_any_filters(db, project.id, "glazing"):
        enabled_glazing = get_enabled_manufacturers(db, project.id, "glazing")
    else:
        enabled_glazing = all_glazing_manufacturers

    return ManufacturerFilterResponseSchema(
        available_frame_manufacturers=all_frame_manufacturers,
        enabled_frame_manufacturers=enabled_frame,
        available_glazing_manufacturers=all_glazing_manufacturers,
        enabled_glazing_manufacturers=enabled_glazing,
    )


@router.patch(
    "/manufacturer-filters/{bt_number}",
    response_model=ManufacturerFilterResponseSchema
)
def update_manufacturer_filters_route(
    bt_number: str,
    update_data: ManufacturerFilterUpdateSchema,
    db: Session = Depends(get_db),
) -> ManufacturerFilterResponseSchema:
    """Update manufacturer filter configuration for a project."""
    logger.info(f"aperture/update_manufacturer_filters_route({bt_number})")

    project = get_project_by_bt_number(db, bt_number)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {bt_number} not found")

    # Get all available manufacturers
    all_frame_manufacturers = get_all_frame_manufacturers(db)
    all_glazing_manufacturers = get_all_glazing_manufacturers(db)

    # Update filters
    update_manufacturer_filters(
        db, project.id, "frame",
        update_data.enabled_frame_manufacturers,
        all_frame_manufacturers
    )
    update_manufacturer_filters(
        db, project.id, "glazing",
        update_data.enabled_glazing_manufacturers,
        all_glazing_manufacturers
    )

    return ManufacturerFilterResponseSchema(
        available_frame_manufacturers=all_frame_manufacturers,
        enabled_frame_manufacturers=update_data.enabled_frame_manufacturers,
        available_glazing_manufacturers=all_glazing_manufacturers,
        enabled_glazing_manufacturers=update_data.enabled_glazing_manufacturers,
    )
```

### Step 2.4: Register Router

**Modify file:** `backend/api.py`

Add import (around line 7):

```python
from features.aperture.routes.manufacturer_filter import router as manufacturer_filter_router
```

Add router registration (around line 33, after `glazing_router`):

```python
    app.include_router(manufacturer_filter_router)
```

---

## Phase 3: Frontend Types & Service

- [x] Completed

### Step 3.1: Add Types

**Modify file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/types.ts`

Add at the end of the file:

```typescript
export interface ManufacturerFilterConfig {
  available_frame_manufacturers: string[];
  enabled_frame_manufacturers: string[];
  available_glazing_manufacturers: string[];
  enabled_glazing_manufacturers: string[];
}
```

### Step 3.2: Create Service

**Create file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/services/manufacturerFilterService.ts`

```typescript
import { getWithAlert } from "../../../../../../../../api/getWithAlert";
import { patchWithAlert } from "../../../../../../../../api/patchWithAlert";
import { ManufacturerFilterConfig } from "../../types";

const CACHE_KEY_PREFIX = "manufacturer_filters_";
const CACHE_EXPIRY_PREFIX = "manufacturer_filters_expiry_";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Service layer for manufacturer filter API calls and caching
 */
export class ManufacturerFilterService {
  private static getCacheKey(btNumber: string): string {
    return `${CACHE_KEY_PREFIX}${btNumber}`;
  }

  private static getCacheExpiryKey(btNumber: string): string {
    return `${CACHE_EXPIRY_PREFIX}${btNumber}`;
  }

  /**
   * Fetch filters from the API and cache them locally
   */
  static async fetchAndCacheFilters(
    btNumber: string,
  ): Promise<ManufacturerFilterConfig> {
    try {
      const filters = await getWithAlert<ManufacturerFilterConfig>(
        `aperture/manufacturer-filters/${btNumber}`,
      );

      if (!filters) {
        throw new Error("No filter configuration received");
      }

      // Cache the data to local storage with expiry
      localStorage.setItem(this.getCacheKey(btNumber), JSON.stringify(filters));
      localStorage.setItem(
        this.getCacheExpiryKey(btNumber),
        (Date.now() + CACHE_DURATION).toString(),
      );

      return filters;
    } catch (error) {
      console.error("Error fetching manufacturer filters:", error);
      throw new Error(`Failed to fetch manufacturer filters: ${error}`);
    }
  }

  /**
   * Update filters and refresh cache
   */
  static async updateFilters(
    btNumber: string,
    enabledFrameManufacturers: string[],
    enabledGlazingManufacturers: string[],
  ): Promise<ManufacturerFilterConfig> {
    try {
      const updatedFilters = await patchWithAlert<ManufacturerFilterConfig>(
        `aperture/manufacturer-filters/${btNumber}`,
        null,
        {
          enabled_frame_manufacturers: enabledFrameManufacturers,
          enabled_glazing_manufacturers: enabledGlazingManufacturers,
        },
      );

      if (!updatedFilters) {
        throw new Error("No response received from filter update");
      }

      // Update cache
      localStorage.setItem(
        this.getCacheKey(btNumber),
        JSON.stringify(updatedFilters),
      );
      localStorage.setItem(
        this.getCacheExpiryKey(btNumber),
        (Date.now() + CACHE_DURATION).toString(),
      );

      return updatedFilters;
    } catch (error) {
      console.error("Error updating manufacturer filters:", error);
      throw new Error(`Failed to update manufacturer filters: ${error}`);
    }
  }

  /**
   * Get cached filters if they exist and are not expired
   */
  static getCachedFilters(btNumber: string): ManufacturerFilterConfig | null {
    try {
      const cachedData = localStorage.getItem(this.getCacheKey(btNumber));
      const cachedExpiry = localStorage.getItem(
        this.getCacheExpiryKey(btNumber),
      );

      if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
        return JSON.parse(cachedData);
      }

      return null;
    } catch (error) {
      console.error("Error reading cached manufacturer filters:", error);
      return null;
    }
  }

  /**
   * Clear cached filters for a project
   */
  static clearCache(btNumber: string): void {
    localStorage.removeItem(this.getCacheKey(btNumber));
    localStorage.removeItem(this.getCacheExpiryKey(btNumber));
  }

  /**
   * Load filters with caching strategy
   */
  static async loadFilters(
    btNumber: string,
  ): Promise<ManufacturerFilterConfig> {
    const cachedFilters = this.getCachedFilters(btNumber);

    if (cachedFilters) {
      return cachedFilters;
    }

    return await this.fetchAndCacheFilters(btNumber);
  }
}
```

---

## Phase 4: Frontend Context

- [x] Completed

### Step 4.1: Create Context

**Create file:** `frontend/src/features/project_view/data_views/windows/_contexts/ManufacturerFilter.Context.tsx`

```typescript
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { ManufacturerFilterConfig } from '../pages/UnitBuilder/types';
import { ManufacturerFilterService } from '../pages/UnitBuilder/ElementsTable/services/manufacturerFilterService';

interface ManufacturerFilterContextType {
    filterConfig: ManufacturerFilterConfig | null;
    enabledFrameManufacturers: string[];
    enabledGlazingManufacturers: string[];
    isLoading: boolean;
    updateFilters: (
        frameMfrs: string[],
        glazingMfrs: string[]
    ) => Promise<void>;
    refreshFilters: () => Promise<void>;
}

const ManufacturerFilterContext = createContext<ManufacturerFilterContextType | undefined>(
    undefined
);

export const ManufacturerFilterProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { btNumber } = useParams<{ btNumber: string }>();
    const [filterConfig, setFilterConfig] = useState<ManufacturerFilterConfig | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadFilters = useCallback(async () => {
        if (!btNumber) return;

        try {
            setIsLoading(true);
            const config = await ManufacturerFilterService.loadFilters(btNumber);
            setFilterConfig(config);
        } catch (error) {
            console.error('Error loading manufacturer filters:', error);
        } finally {
            setIsLoading(false);
        }
    }, [btNumber]);

    useEffect(() => {
        loadFilters();
    }, [loadFilters]);

    const updateFilters = useCallback(
        async (frameMfrs: string[], glazingMfrs: string[]) => {
            if (!btNumber) return;

            try {
                setIsLoading(true);
                const updatedConfig = await ManufacturerFilterService.updateFilters(
                    btNumber,
                    frameMfrs,
                    glazingMfrs
                );
                setFilterConfig(updatedConfig);
            } catch (error) {
                console.error('Error updating manufacturer filters:', error);
                alert('Error updating filters. Please try again.');
            } finally {
                setIsLoading(false);
            }
        },
        [btNumber]
    );

    const refreshFilters = useCallback(async () => {
        if (!btNumber) return;
        ManufacturerFilterService.clearCache(btNumber);
        await loadFilters();
    }, [btNumber, loadFilters]);

    // Compute enabled lists (default to all if no config)
    const enabledFrameManufacturers = filterConfig?.enabled_frame_manufacturers ?? [];
    const enabledGlazingManufacturers = filterConfig?.enabled_glazing_manufacturers ?? [];

    return (
        <ManufacturerFilterContext.Provider
            value={{
                filterConfig,
                enabledFrameManufacturers,
                enabledGlazingManufacturers,
                isLoading,
                updateFilters,
                refreshFilters,
            }}
        >
            {children}
        </ManufacturerFilterContext.Provider>
    );
};

export const useManufacturerFilters = (): ManufacturerFilterContextType => {
    const context = useContext(ManufacturerFilterContext);
    if (!context) {
        throw new Error(
            'useManufacturerFilters must be used within a ManufacturerFilterProvider'
        );
    }
    return context;
};
```

### Step 4.2: Add Provider to Dashboard

**Modify file:** `frontend/src/features/project_view/data_views/windows/WindowDataDashboard.tsx`

Add import (around line 9):

```typescript
import { ManufacturerFilterProvider } from "./_contexts/ManufacturerFilter.Context";
```

Wrap the existing providers with `ManufacturerFilterProvider`. Replace the return statement (lines 35-50) with:

```typescript
    return (
        <>
            <DataDashboardTabBar tabs={tabs} activeTab={activeTab} onTabChange={tabNumber => setActiveTab(tabNumber)} />
            <ManufacturerFilterProvider>
                <AperturesProvider>
                    <FrameTypesProvider>
                        <GlazingTypesProvider>
                            <DataViewPage>
                                <ContentBlocksContainer>
                                    <Outlet />
                                </ContentBlocksContainer>
                            </DataViewPage>
                        </GlazingTypesProvider>
                    </FrameTypesProvider>
                </AperturesProvider>
            </ManufacturerFilterProvider>
        </>
    );
```

---

## Phase 5: Filter Modal UI

- [x] Completed

### Step 5.1: Create Modal Component

**Create directory:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ManufacturerFilterModal/`

**Create file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ManufacturerFilterModal/Modal.ManufacturerFilter.tsx`

```typescript
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    FormControlLabel,
    Checkbox,
    Divider,
    CircularProgress,
    Link,
} from '@mui/material';

import { useManufacturerFilters } from '../../../_contexts/ManufacturerFilter.Context';

interface ManufacturerFilterModalProps {
    open: boolean;
    onClose: () => void;
}

interface ManufacturerSection {
    title: string;
    available: string[];
    enabled: string[];
    setEnabled: (manufacturers: string[]) => void;
}

const ManufacturerSection: React.FC<ManufacturerSection> = ({
    title,
    available,
    enabled,
    setEnabled,
}) => {
    const handleToggle = (manufacturer: string) => {
        if (enabled.includes(manufacturer)) {
            setEnabled(enabled.filter(m => m !== manufacturer));
        } else {
            setEnabled([...enabled, manufacturer]);
        }
    };

    const handleSelectAll = () => setEnabled([...available]);
    const handleSelectNone = () => setEnabled([]);

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                    {title}
                </Typography>
                <Box>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={handleSelectAll}
                        sx={{ mr: 2 }}
                    >
                        Select All
                    </Link>
                    <Link component="button" variant="body2" onClick={handleSelectNone}>
                        Select None
                    </Link>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', pl: 1 }}>
                {available.map(manufacturer => (
                    <FormControlLabel
                        key={manufacturer}
                        control={
                            <Checkbox
                                checked={enabled.includes(manufacturer)}
                                onChange={() => handleToggle(manufacturer)}
                                size="small"
                            />
                        }
                        label={manufacturer}
                        sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
                    />
                ))}
            </Box>
        </Box>
    );
};

export const ManufacturerFilterModal: React.FC<ManufacturerFilterModalProps> = ({
    open,
    onClose,
}) => {
    const { filterConfig, updateFilters, isLoading } = useManufacturerFilters();

    // Local state for editing
    const [enabledFrames, setEnabledFrames] = useState<string[]>([]);
    const [enabledGlazings, setEnabledGlazings] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize local state when modal opens or config changes
    useEffect(() => {
        if (filterConfig) {
            setEnabledFrames([...filterConfig.enabled_frame_manufacturers]);
            setEnabledGlazings([...filterConfig.enabled_glazing_manufacturers]);
        }
    }, [filterConfig, open]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateFilters(enabledFrames, enabledGlazings);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset to original values
        if (filterConfig) {
            setEnabledFrames([...filterConfig.enabled_frame_manufacturers]);
            setEnabledGlazings([...filterConfig.enabled_glazing_manufacturers]);
        }
        onClose();
    };

    if (!filterConfig) {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
            <DialogTitle>Configure Manufacturer Filters</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Select which manufacturers to show in the frame and glazing type
                    dropdowns. Unchecked manufacturers will be hidden from selection.
                </Typography>

                <ManufacturerSection
                    title="Frame Manufacturers"
                    available={filterConfig.available_frame_manufacturers}
                    enabled={enabledFrames}
                    setEnabled={setEnabledFrames}
                />

                <Divider sx={{ my: 2 }} />

                <ManufacturerSection
                    title="Glazing Manufacturers"
                    available={filterConfig.available_glazing_manufacturers}
                    enabled={enabledGlazings}
                    setEnabled={setEnabledGlazings}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} disabled={isSaving}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={isSaving || isLoading}
                >
                    {isSaving ? <CircularProgress size={20} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
```

---

## Phase 6: Header Menu Integration

- [x] Completed

### Step 6.1: Update Header Buttons

**Modify file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx`

Replace the entire file with:

```typescript
import { CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import TuneIcon from '@mui/icons-material/Tune';
import { useFrameTypes } from '../../../_contexts/FrameType.Context';
import { useGlazingTypes } from '../../../_contexts/GlazingTypes.Context';
import { useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { ManufacturerFilterModal } from '../ManufacturerFilterModal/Modal.ManufacturerFilter';

interface HeaderActionItem {
    id: 'refresh_frames' | 'refresh_glazings' | 'configure_filters';
    label: string;
    helperText: string;
    icon: ReactNode;
    handler: () => void | Promise<void>;
    loading?: boolean;
}

const HeaderActionsMenu: React.FC<{ items: HeaderActionItem[] }> = ({ items }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Tooltip title="More actions" placement="top" arrow>
                <IconButton
                    size="small"
                    onClick={handleOpen}
                    aria-label="More actions"
                    aria-controls={isOpen ? 'aperture-header-actions-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isOpen ? 'true' : undefined}
                >
                    <MoreHorizIcon />
                </IconButton>
            </Tooltip>

            <Menu
                id="aperture-header-actions-menu"
                anchorEl={anchorEl}
                open={isOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {items.map(item => (
                    <MenuItem
                        key={item.id}
                        disabled={item.loading}
                        onClick={() => {
                            handleClose();
                            item.handler();
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                            {item.loading ? <CircularProgress size={16} /> : item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} secondary={item.helperText} />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

export function useHeaderButtons(): ReactElement[] {
    const userContext = useContext(UserContext);
    const { isLoadingFrameTypes, handleRefreshFrameTypes } = useFrameTypes();
    const { isLoadingGlazingTypes, handleRefreshGlazingTypes } = useGlazingTypes();
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const menuItems = useMemo<HeaderActionItem[]>(
        () => [
            {
                id: 'configure_filters',
                label: 'Configure manufacturer filters',
                helperText: 'Select visible manufacturers',
                icon: <TuneIcon fontSize="small" />,
                handler: () => setIsFilterModalOpen(true),
            },
            {
                id: 'refresh_frames',
                label: 'Refresh frame types',
                helperText: 'Reload from AirTable',
                icon: <RefreshRoundedIcon fontSize="small" />,
                handler: handleRefreshFrameTypes,
                loading: isLoadingFrameTypes,
            },
            {
                id: 'refresh_glazings',
                label: 'Refresh glazing types',
                helperText: 'Reload from AirTable',
                icon: <RefreshRoundedIcon fontSize="small" />,
                handler: handleRefreshGlazingTypes,
                loading: isLoadingGlazingTypes,
            },
        ],
        [handleRefreshFrameTypes, handleRefreshGlazingTypes, isLoadingFrameTypes, isLoadingGlazingTypes]
    );

    if (!userContext.user) {
        return [];
    }

    return [
        <HeaderActionsMenu key="header-actions" items={menuItems} />,
        <ManufacturerFilterModal
            key="filter-modal"
            open={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
        />,
    ];
}
```

---

## Phase 7: Apply Filters to Selectors

- [x] Completed

### Step 7.1: Update FrameTypeSelector

**Modify file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/FrameTypeSelector.tsx`

Replace the entire file with:

```typescript
import { useContext, useMemo } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useFrameTypes } from '../../../_contexts/FrameType.Context';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { useManufacturerFilters } from '../../../_contexts/ManufacturerFilter.Context';

import { FrameSelectorProps } from './types';

export const FrameSelector: React.FC<FrameSelectorProps> = ({
    aperture,
    element,
    selectedFrameType,
    isLoading = false,
    position,
}) => {
    const userContext = useContext(UserContext);
    const { frameTypes } = useFrameTypes();
    const { handleUpdateApertureElementFrameType } = useApertures();
    const { filterConfig, enabledFrameManufacturers } = useManufacturerFilters();
    const placeholderText = `Select ${position.toLowerCase()} frame`;

    // Filter frame types by enabled manufacturers
    const filteredFrameTypes = useMemo(() => {
        // If no filter config, show all (backwards compatible)
        if (!filterConfig) {
            return frameTypes;
        }

        return frameTypes.filter(frame => {
            // Always show frames with no manufacturer set
            if (!frame.manufacturer) {
                return true;
            }
            return enabledFrameManufacturers.includes(frame.manufacturer);
        });
    }, [frameTypes, filterConfig, enabledFrameManufacturers]);

    if (!userContext.user) {
        return <span>{selectedFrameType?.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={[...filteredFrameTypes].sort((a, b) => a.name.localeCompare(b.name))}
                getOptionLabel={option => option.name}
                value={selectedFrameType}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementFrameType({
                        apertureId: aperture.id,
                        elementId: element.id,
                        framePosition: position,
                        frameTypeId: newValue ? newValue.id : null,
                    })
                }
                loading={isLoading}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder={placeholderText}
                        variant="outlined"
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                fontSize: '0.75rem',
                                minHeight: 'auto',
                                '& .MuiOutlinedInput-input': {
                                    padding: '4px 8px',
                                },
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{option.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>
                                Width: {option.width_mm}mm, U-Value: {option.u_value_w_m2k}
                            </div>
                        </div>
                    </li>
                )}
            />
        </FormControl>
    );
};
```

### Step 7.2: Update GlazingTypeSelector

**Modify file:** `frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/GlazingTypeSelector.tsx`

Replace the entire file with:

```typescript
import { useContext, useMemo } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useGlazingTypes } from '../../../_contexts/GlazingTypes.Context';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { useManufacturerFilters } from '../../../_contexts/ManufacturerFilter.Context';

import { GlazingSelectorProps } from './types';

export const GlazingSelector: React.FC<GlazingSelectorProps> = ({
    element,
    selectedGlazingType,
    isLoading = false,
}) => {
    const userContext = useContext(UserContext);
    const { glazingTypes } = useGlazingTypes();
    const { handleUpdateApertureElementGlazing } = useApertures();
    const { filterConfig, enabledGlazingManufacturers } = useManufacturerFilters();
    const placeholderText = `Glazing type...`;

    // Filter glazing types by enabled manufacturers
    const filteredGlazingTypes = useMemo(() => {
        // If no filter config, show all (backwards compatible)
        if (!filterConfig) {
            return glazingTypes;
        }

        return glazingTypes.filter(glazing => {
            // Always show glazings with no manufacturer set
            if (!glazing.manufacturer) {
                return true;
            }
            return enabledGlazingManufacturers.includes(glazing.manufacturer);
        });
    }, [glazingTypes, filterConfig, enabledGlazingManufacturers]);

    if (!userContext.user) {
        return <span>{selectedGlazingType.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={[...filteredGlazingTypes].sort((a, b) => a.name.localeCompare(b.name))}
                getOptionLabel={option => option.name}
                value={selectedGlazingType}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementGlazing({
                        elementId: element.id,
                        glazingTypeId: newValue ? newValue.id : null,
                    })
                }
                loading={isLoading}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder={placeholderText}
                        variant="outlined"
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                fontSize: '0.75rem',
                                minHeight: 'auto',
                                '& .MuiOutlinedInput-input': {
                                    padding: '4px 8px',
                                },
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{option.name}</div>
                            <div style={{ fontSize: '0.7em', color: '#666' }}>
                                U-Value: {option.u_value_w_m2k}, g-Value: {option.g_value}
                            </div>
                        </div>
                    </li>
                )}
            />
        </FormControl>
    );
};
```

---

## Verification Checklist

After implementation, verify:

1. **Backend:**
   - [ ] Run `cd backend && alembic upgrade head` successfully
   - [ ] Test GET `/aperture/manufacturer-filters/{bt_number}` returns filter config
   - [ ] Test PATCH `/aperture/manufacturer-filters/{bt_number}` saves filters

2. **Frontend:**
   - [ ] "..." menu in aperture header shows "Configure manufacturer filters" option
   - [ ] Modal opens with checkboxes for all manufacturers
   - [ ] "Select All" and "Select None" links work
   - [ ] Save button persists changes
   - [ ] Frame/Glazing selectors show only enabled manufacturers
   - [ ] Filters persist after page refresh
   - [ ] Different projects have independent filter settings

---

## File Summary

### New Files (7)

| File                                                                | Purpose          |
| ------------------------------------------------------------------- | ---------------- |
| `backend/db_entities/app/manufacturer_filter.py`                    | Database entity  |
| `backend/features/aperture/schemas/manufacturer_filter.py`          | Pydantic schemas |
| `backend/features/aperture/services/manufacturer_filter.py`         | Service layer    |
| `backend/features/aperture/routes/manufacturer_filter.py`           | API routes       |
| `backend/alembic/versions/xxxx_add_manufacturer_filters.py`         | Migration        |
| `frontend/.../services/manufacturerFilterService.ts`                | API service      |
| `frontend/.../_contexts/ManufacturerFilter.Context.tsx`             | React context    |
| `frontend/.../ManufacturerFilterModal/Modal.ManufacturerFilter.tsx` | Filter modal     |

### Modified Files (5)

| File                                      | Change                |
| ----------------------------------------- | --------------------- |
| `backend/db_entities/app/project.py`      | Add relationship      |
| `backend/api.py`                          | Register router       |
| `frontend/.../WindowDataDashboard.tsx`    | Add provider          |
| `frontend/.../Aperture.HeaderButtons.tsx` | Add menu item + modal |
| `frontend/.../FrameTypeSelector.tsx`      | Apply filter          |
| `frontend/.../GlazingTypeSelector.tsx`    | Apply filter          |
