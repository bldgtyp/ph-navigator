"""PH-Navigator V2 FastAPI entrypoint — scaffold only.

The real route surface lands during feature work. This stub exists so
`make backend` and `make smoke` succeed against a fresh clone and so
Playwright MCP has a target to hit while the env is being verified.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

app = FastAPI(
    title="PH-Navigator V2",
    version="0.1.0-scaffold",
    description="Scaffold — feature routes added during V2 build.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ph-navigator-v2", "phase": "scaffold"}
