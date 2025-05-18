# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references


from fastapi import Form

from pydantic import BaseModel

class SegmentPhotoUploadResponse(BaseModel):
    public_url: str