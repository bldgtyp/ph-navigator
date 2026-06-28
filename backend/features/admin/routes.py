"""Admin user-management HTTP routes.

The endpoints, request/response models, and the `admin.users.manage`
authorization gate are added in Phase 04. This module currently declares the
router so the service layer satisfies the feature-shape boundary; it is wired
into `main.py` when the routes land.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
