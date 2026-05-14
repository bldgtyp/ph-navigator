"""Global catalogs (bookshelf model) — see context/technical-requirements/data-model.md §7."""

from fastapi import APIRouter

from features.catalogs.frame_types import router as frame_types_router
from features.catalogs.glazing_types import router as glazing_types_router
from features.catalogs.materials import router as materials_router

# Single import surface for main.py: one parent router that includes all
# three v1 catalogs. Each submodule still owns its own URL prefix and tags.
routers: tuple[APIRouter, ...] = (
    materials_router,
    frame_types_router,
    glazing_types_router,
)

__all__ = ["routers"]
