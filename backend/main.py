# -*- Python Version: 3.11 -*-

import logging
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import register_routes
from config import settings
from logs._logging_config import configure_logging

configure_logging()
logger = logging.getLogger()

app = FastAPI(
    # docs_url=None,  # Disable docs in production
    # redoc_url=None,  # Disable redoc in production
)


@app.get("/")
async def root():
    return {"message": "Welcome to PH-Navigator."}


register_routes(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Add request IDs for better debugging
@app.middleware("http")
async def add_request_id_middleware(request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# TODO: Can I enable these in production?
# app.add_middleware(HTTPSRedirectMiddleware)  # Force HTTPS
# app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.CORS_ORIGINS)


# Add HTTP Security Headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
