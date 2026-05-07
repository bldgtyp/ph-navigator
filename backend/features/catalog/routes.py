# -*- Python Version: 3.11 -*-

from fastapi import APIRouter

router = APIRouter(prefix="/api/catalog-poc", tags=["catalog-poc"])


@router.get("/ping")
async def ping() -> dict[str, str]:
    return {"status": "ok", "module": "catalog-poc"}
