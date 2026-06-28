"""PH-Navigator FastAPI entrypoint.

Feature routes are added incrementally by tracer-bullet slice.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config import settings
from database import close_pool, open_pool
from features.admin.routes import router as admin_router
from features.aperture_drift.routes import router as aperture_drift_router
from features.aperture_hbjson_export.routes import router as aperture_hbjson_export_router
from features.aperture_u_value.routes import router as aperture_u_value_router
from features.apertures.routes import router as apertures_router
from features.assets.routes import jobs_router as asset_jobs_router
from features.assets.routes import router as assets_router
from features.auth.routes import router as auth_router
from features.catalogs import routers as catalog_routers
from features.climate.routes import router as climate_router
from features.envelope.routes import router as envelope_router
from features.heat_pumps.routes import router as heat_pumps_router
from features.mcp.routes import router as mcp_token_router
from features.mcp.server import mcp as phn_mcp
from features.model_viewer.routes import router as model_viewer_router
from features.project_climate_source.routes import router as project_climate_source_router
from features.project_document.routes import diff_router as project_diff_router
from features.project_document.routes import router as project_document_router
from features.project_location.routes import router as project_location_router
from features.project_status.routes import router as project_status_router
from features.projects.routes import router as projects_router
from features.schemas.routes import router as schemas_router
from features.shared.errors import http_exception_handler, validation_exception_handler
from features.shared.middleware import request_context_middleware
from features.system.routes import router as system_router
from features.table_views.routes import router as table_views_router
from logging_config import configure_logging

configure_logging(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    open_pool()
    async with phn_mcp.session_manager.run():
        try:
            yield
        finally:
            close_pool()


app = FastAPI(
    title="PH-Navigator",
    version=settings.app_version,
    description="PH-Navigator API.",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id", "X-Request-ID"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.middleware("http")(request_context_middleware)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(projects_router)
app.include_router(project_location_router)
app.include_router(project_climate_source_router)
app.include_router(assets_router)
app.include_router(asset_jobs_router)
app.include_router(project_diff_router)
app.include_router(project_document_router)
app.include_router(envelope_router)
app.include_router(heat_pumps_router)
app.include_router(project_status_router)
app.include_router(model_viewer_router)
app.include_router(mcp_token_router)
for catalog_router in catalog_routers:
    app.include_router(catalog_router)
app.include_router(climate_router)
app.include_router(schemas_router)
app.include_router(system_router)
app.include_router(table_views_router)
app.include_router(apertures_router)
app.include_router(aperture_u_value_router)
app.include_router(aperture_hbjson_export_router)
app.include_router(aperture_drift_router)
app.mount("/mcp", phn_mcp.streamable_http_app())
