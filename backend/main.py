"""PH-Navigator V2 FastAPI entrypoint.

Feature routes are added incrementally by tracer-bullet slice.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from features.auth.routes import router as auth_router
from features.shared.errors import http_exception_handler, validation_exception_handler
from features.shared.middleware import request_context_middleware
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

app.middleware("http")(request_context_middleware)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(auth_router)
app.include_router(system_router)
