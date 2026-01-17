# Windows View: Manufacturer Filter Feature

**Status:** Planning
**Created:** 2026-01-17

## Problem Statement

As the AirTable database of frame types and glazing types grows, the dropdown lists in the Unit Builder become unwieldy. Users need a way to filter which manufacturers' products appear in the selection dropdowns on a **per-project basis**.

---

## Confirmed Requirements

1. **Separate filters**: Independent filters for Frame manufacturers and Glazing manufacturers
2. **Per-project storage**: Filter configurations stored in PostgreSQL per project
3. **Access via header menu**: "Configure Filters" option in existing "..." menu
4. **Default behavior**: Show all manufacturers when no filter is configured (backwards compatible)
5. **Logged-in users only**: Filter UI and configuration only available to authenticated users

---

## Implementation Plan

### Phase 1: Backend Foundation

#### 1.1 New Database Entity

**File:** `backend/db_entities/app/manufacturer_filter.py` (NEW)

```python
class ProjectManufacturerFilter(Base):
    __tablename__ = "project_manufacturer_filters"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = MappedColumn(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    manufacturer: Mapped[str] = MappedColumn(String(255), nullable=False)
    filter_type: Mapped[str] = MappedColumn(String(50), nullable=False)  # 'frame' or 'glazing'
    is_enabled: Mapped[bool] = MappedColumn(Boolean, nullable=False, default=True)

    project: Mapped["Project"] = relationship("Project", back_populates="manufacturer_filters")
```

**Design notes:**
- Row-per-manufacturer approach (vs JSON) for queryability
- `filter_type` distinguishes frame vs glazing
- `is_enabled` allows toggling without record deletion

#### 1.2 Update Project Entity

**File:** `backend/db_entities/app/project.py` (MODIFY)

Add relationship:
```python
manufacturer_filters: Mapped[list["ProjectManufacturerFilter"]] = relationship(
    "ProjectManufacturerFilter",
    back_populates="project",
    cascade="all, delete-orphan",
)
```

#### 1.3 Alembic Migration

**File:** `backend/alembic/versions/xxxx_add_manufacturer_filters.py` (NEW)

Creates `project_manufacturer_filters` table with indexes.

#### 1.4 API Routes

**File:** `backend/features/aperture/routes/manufacturer_filter.py` (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/aperture/manufacturer-filters/{bt_number}` | Get filter config for project |
| PATCH | `/aperture/manufacturer-filters/{bt_number}` | Update filter config |

**Response Schema:**
```python
class ManufacturerFilterResponseSchema(BaseModel):
    available_frame_manufacturers: list[str]
    enabled_frame_manufacturers: list[str]
    available_glazing_manufacturers: list[str]
    enabled_glazing_manufacturers: list[str]
```

#### 1.5 Service Layer

**File:** `backend/features/aperture/services/manufacturer_filter.py` (NEW)

Key functions:
- `get_all_frame_manufacturers(db)` - Extract unique manufacturers from frame_types table
- `get_all_glazing_manufacturers(db)` - Extract unique manufacturers from glazing_types table
- `get_project_manufacturer_filters(db, bt_number)` - Get filter config
- `update_project_manufacturer_filters(db, bt_number, frame_mfrs, glazing_mfrs)` - Save config

---

### Phase 2: Frontend Foundation

#### 2.1 Types

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/types.ts` (MODIFY)

```typescript
export interface ManufacturerFilterConfig {
    available_frame_manufacturers: string[];
    enabled_frame_manufacturers: string[];
    available_glazing_manufacturers: string[];
    enabled_glazing_manufacturers: string[];
}
```

#### 2.2 Service Layer

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/ElementsTable/services/manufacturerFilterService.ts` (NEW)

- Follows pattern from `frameTypeService.ts`
- 24-hour localStorage caching
- `fetchFilters(btNumber)`, `updateFilters(btNumber, frameMfrs, glazingMfrs)`, `getCachedFilters(btNumber)`

#### 2.3 Context Provider

**File:** `frontend/src/features/.../windows/_contexts/ManufacturerFilter.Context.tsx` (NEW)

Provides:
- `filterConfig` - Current filter configuration
- `enabledFrameManufacturers` - Array of enabled frame manufacturers
- `enabledGlazingManufacturers` - Array of enabled glazing manufacturers
- `updateFilters(frameMfrs, glazingMfrs)` - Save new config
- `isLoading` - Loading state

---

### Phase 3: UI Integration

#### 3.1 Filter Configuration Modal

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/ManufacturerFilterModal/Modal.ManufacturerFilter.tsx` (NEW)

```
┌─────────────────────────────────────────────────────────────┐
│ Configure Manufacturer Filters                        [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Frame Manufacturers          [Select All] [Select None]    │
│ ☑ Alpen                                                    │
│ ☑ Intus                                                    │
│ ☐ Internorm                                                │
│ ☑ Zola                                                     │
│ ...                                                        │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ Glazing Manufacturers        [Select All] [Select None]    │
│ ☑ Saint-Gobain                                             │
│ ☑ Guardian                                                 │
│ ☐ AGC                                                      │
│ ...                                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                    [Cancel]     [Save]     │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Header Menu Integration

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx` (MODIFY)

Add new menu item:
```typescript
{
    id: 'configure_filters',
    label: 'Configure manufacturer filters',
    helperText: 'Select visible manufacturers',
    icon: <TuneIcon fontSize="small" />,
    handler: () => setIsFilterModalOpen(true),
}
```

#### 3.3 Apply Filters to Selectors

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/ElementsTable/FrameTypeSelector.tsx` (MODIFY)

```typescript
const { enabledFrameManufacturers, filterConfig } = useManufacturerFilters();

const filteredFrameTypes = useMemo(() => {
    if (!filterConfig) return frameTypes; // No config = show all
    return frameTypes.filter(frame => {
        if (!frame.manufacturer) return true; // Show items with no manufacturer
        return enabledFrameManufacturers.includes(frame.manufacturer);
    });
}, [frameTypes, enabledFrameManufacturers, filterConfig]);
```

**File:** `frontend/src/features/.../windows/pages/UnitBuilder/ElementsTable/GlazingTypeSelector.tsx` (MODIFY)

Same pattern for glazing types.

#### 3.4 Provider Integration

**File:** `frontend/src/features/.../windows/WindowDataDashboard.tsx` (MODIFY)

Add `ManufacturerFilterProvider` to provider hierarchy.

---

## Files Summary

### New Files (8)
| File | Description |
|------|-------------|
| `backend/db_entities/app/manufacturer_filter.py` | Database entity |
| `backend/features/aperture/routes/manufacturer_filter.py` | API routes |
| `backend/features/aperture/services/manufacturer_filter.py` | Service layer |
| `backend/features/aperture/schemas/manufacturer_filter.py` | Pydantic schemas |
| `backend/alembic/versions/xxxx_add_manufacturer_filters.py` | Migration |
| `frontend/.../services/manufacturerFilterService.ts` | API service |
| `frontend/.../_contexts/ManufacturerFilter.Context.tsx` | React context |
| `frontend/.../ManufacturerFilterModal/Modal.ManufacturerFilter.tsx` | Config modal |

### Modified Files (5)
| File | Change |
|------|--------|
| `backend/db_entities/app/project.py` | Add relationship |
| `backend/api.py` | Register new router |
| `frontend/.../Aperture.HeaderButtons.tsx` | Add menu item |
| `frontend/.../FrameTypeSelector.tsx` | Apply filter |
| `frontend/.../GlazingTypeSelector.tsx` | Apply filter |
| `frontend/.../WindowDataDashboard.tsx` | Add provider |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No filters configured | Show ALL manufacturers (backwards compatible) |
| All filters disabled | Show NONE (user explicitly chose this) |
| Frame/glazing with NULL manufacturer | Always shown (can't filter) |
| New manufacturer from AirTable refresh | NOT auto-enabled, user must configure |
| Non-logged-in user | Sees all manufacturers (selectors are read-only anyway) |

---

## Verification Plan

1. **Backend testing:**
   - Run Alembic migration successfully
   - Test API routes with curl/Postman
   - Verify filter persistence in database

2. **Frontend testing:**
   - Open modal from header menu
   - Toggle checkboxes and save
   - Verify selectors show filtered options
   - Test cache invalidation on update

3. **Integration testing:**
   - Create project → Configure filters → Verify dropdowns filtered
   - Refresh page → Verify filters persist
   - Test with another project → Verify filters are independent
