# Performance Improvements TODO

**DATE:** 2026-01-22
**SOURCE:** Extracted from `2026-01-22_performance-audit-plan.md`
**STATUS:** Items to revisit in future development cycles

---

## Overview

This document contains performance recommendations that were identified during the January 2026 audit but not implemented as part of the initial "Quick Wins" sprint. These items range from architectural changes to incremental improvements.

---

## Architecture Recommendations (High Impact, Higher Effort)

### 1. Adopt React Query or SWR for Data Fetching

**Impact:** HIGH | **Effort:** MEDIUM

A single library adoption would solve multiple issues:

- Automatic request caching
- Request deduplication (prevents duplicate in-flight requests)
- Automatic retries with exponential backoff
- Request cancellation on component unmount
- Background refetching for stale data

**Files affected:** All `src/api/*.tsx` files, all context providers that fetch data

---

### 2. Implement Route-Based Code Splitting

**Impact:** HIGH | **Effort:** MEDIUM

Currently all routes are eagerly loaded, resulting in ~800KB+ initial bundle.

```typescript
// Instead of:
import ProjectView from "./features/project_view/ProjectView";

// Use:
const ProjectView = React.lazy(
  () => import("./features/project_view/ProjectView"),
);
```

**Key targets:**

- 3D Model Viewer (Three.js) - load only when viewing model tab
- PDF generation libraries - load only when exporting
- Data view pages - load on route navigation

---

### 3. Consider Zustand for 3D Viewer State

**Impact:** MEDIUM | **Effort:** MEDIUM

The 3D viewer currently has 6+ nested context providers. Zustand would:

- Simplify state management with a single store
- Enable fine-grained subscriptions (components only re-render when their slice changes)
- Eliminate provider nesting

---

### 4. Add Application Performance Monitoring (APM)

**Impact:** MEDIUM | **Effort:** LOW

Track real-user performance metrics to identify bottlenecks in production:

- Core Web Vitals (LCP, FID, CLS)
- API response times
- Error rates by endpoint

Options: Sentry Performance, DataDog RUM, or simple custom analytics

---

## Frontend Improvements

### Replace window.alert() with Toast Notifications

**Priority:** MEDIUM | **Files:** All `*WithAlert.tsx` API wrappers

`window.alert()` is synchronous and blocks the UI. Replace with non-blocking toast notifications (MUI Snackbar or react-toastify).

---

### Remove Console Logging of Token Fragments

**Priority:** LOW | **File:** `UserContext.tsx:19-22`

Security hygiene - remove token logging even in truncated form.

---

### Add Authorization Header to DELETE Requests

**Priority:** MEDIUM | **File:** `deleteWithAlert.tsx`

DELETE requests are missing the `Authorization: Bearer` header that other methods include.

---

### Parallelize File Uploads

**Priority:** LOW | **Files:** `uploadDatasheetFiles.tsx`, `uploadSitePhotoFiles.tsx`

Currently uploads files sequentially. Use `Promise.all()` with concurrency limit.

---

### Split Large Contexts

**Priority:** MEDIUM | **Files:** `Assembly.Context.tsx`, `Aperture.Context.tsx`

These contexts have 20+ values each. Consider splitting into:

- Data context (read-only state)
- Actions context (handlers/mutations)
- Selection context (UI state)

---

### Fix Continuous Animation Loop in 3D Viewer

**Priority:** MEDIUM | **File:** `World.tsx`

Animation loop runs continuously. Switch to render-on-demand using OrbitControls' `change` event.

```typescript
controls.addEventListener("change", () => renderer.render(scene, camera));
```

---

### Add Geometry/Material Disposal on Model Reset

**Priority:** MEDIUM | **File:** `World.tsx`

Currently clears scene without disposing Three.js resources, causing memory leaks.

```typescript
scene.traverse((object) => {
  if (object.geometry) object.geometry.dispose();
  if (object.material) object.material.dispose();
});
```

---

### Create Material Cache for ColorBy Mode

**Priority:** LOW | **File:** `modeColorBy.tsx`

Currently creates new material per mesh. Cache by color string to reuse materials.

---

### Remove Disabled DataGrid Scrolling

**Priority:** MEDIUM | **File:** `DataGrid.tsx` (StyledDataGrid)

`overflowY: 'hidden'` disables virtualization benefits. Remove and test with large datasets.

---

### Re-enable React StrictMode

**Priority:** LOW | **File:** `index.tsx`

StrictMode is commented out. Re-enable to catch potential issues during development.

---

## Backend Improvements

### Add Pagination to List Endpoints

**Priority:** HIGH | **Files:** All routes returning lists

Currently returns all records. Add `skip`/`limit` parameters:

```python
@router.get("/items")
def get_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Item).offset(skip).limit(limit).all()
```

---

### Fix N+1 Query Patterns

**Priority:** HIGH | **Files:** `aperture/services.py`, `assembly/services.py`

Add eager loading for relationships:

```python
# Instead of:
db.query(Aperture).filter(...)

# Use:
db.query(Aperture).options(
    selectinload(Aperture.elements)
).filter(...)
```

---

### Create GCS Client Singleton

**Priority:** MEDIUM | **File:** `features/google_cloud/services.py`

Currently creates new client on every operation. Use module-level singleton.

---

### Make AirTable Calls Async

**Priority:** LOW | **File:** `features/air_table/services.py`

pyairtable is synchronous. Either use `aiohttp` directly or wrap in `run_in_executor()`.

---

### Conditionally Disable API Docs in Production

**Priority:** LOW | **File:** `main.py`

```python
app = FastAPI(
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)
```

---

### Add Cache-Control Headers for Static Data

**Priority:** LOW | **File:** `main.py`

Add caching headers for endpoints that return rarely-changing data (materials, frame types, glazing types).

---

## Database Improvements

### Add Composite Indexes for Common Queries

**Priority:** MEDIUM

```python
# For queries filtering by project + other columns
Index('ix_aperture_project_name', 'project_id', 'name')
Index('ix_assembly_project_type', 'project_id', 'assembly_type')
```

---

### Add Unique Constraint on Project bt_number

**Priority:** LOW | **File:** `db_entities/project.py`

If `bt_number` should be unique per project, add constraint.

---

### Review Nullable Foreign Keys

**Priority:** LOW

Some FK columns allow NULL without clear intention. Review and add defaults or constraints as appropriate.

---

## Completed Items (Reference)

The following were completed in the January 2026 Quick Wins sprint:
`/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/docs/plans/2026-01-22/2026-01-22_window-u-value-caching.md`

1. ✅ Add FK indexes migration (18 indexes)
2. ✅ Fix doubled pixel ratio in SceneSetup.tsx
3. ✅ Reuse Raycaster/Vector2 in selectMesh.tsx
4. ✅ Add GZipMiddleware to main.py
5. ✅ Parallelize 3D model API calls (Promise.all)
6. ✅ Add HTTP timeouts to requests.get() calls
7. ✅ Fix SlowAPI state attachment
8. ✅ Add useMemo to context values (15 files)
9. ✅ Fix ResultsDataGrids mutation bug
10. ✅ Create combined model-data endpoint

---

## Prioritization Guide

When selecting items to work on:

| Priority   | Criteria                                                       |
| ---------- | -------------------------------------------------------------- |
| **HIGH**   | Blocking bugs, significant performance impact, security issues |
| **MEDIUM** | Noticeable UX improvement, technical debt reduction            |
| **LOW**    | Nice-to-have, minor optimizations, code quality                |

**Recommended next sprint focus:**

1. React Query adoption (solves multiple issues)
2. Route-based code splitting (reduces initial load)
3. N+1 query fixes (database performance)
