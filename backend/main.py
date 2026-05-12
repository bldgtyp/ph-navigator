"""PH-Navigator V2 FastAPI entrypoint.

Feature routes are added incrementally by tracer-bullet slice.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from features.system.routes import router as system_router

app = FastAPI(
    title="PH-Navigator V2",
    version=settings.app_version,
    description="PH-Navigator V2 API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(system_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Backward-compatible scaffold health route.

    New clients should use `/api/v1/health`.
    """
    return {"status": "ok", "service": "ph-navigator-v2", "phase": "tb-00"}
