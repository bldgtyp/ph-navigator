# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, root_validator


class AirTableMaterialSchema(BaseModel):
    """Schema for Material records when they come in directly from AirTable."""
    id: str
    name: str = ""
    category: str = ""
    argb_color: str = ""
    conductivity_w_mk: float = 0.0
    emissivity: float = 0.0

    @root_validator(pre=True)
    def lowercase_keys(cls, values):
        # Convert all keys to lowercase
        return {k.lower(): v for k, v in values.items()}
    
    class Config:
        from_attributes = True
        orm_mode = True


class MaterialSchema(BaseModel):
    """Schema for Material records in the database."""
    id: str
    name: str = ""
    category: str = ""
    argb_color: str = ""
    conductivity_w_mk: float = 0.0
    emissivity: float = 0.0

    class Config:
        orm_mode = True


class AssemblyLayerSegmentSchema(BaseModel):
    id: int
    layer_id: int
    material_id: int
    order: int
    width_mm: float
    material: AirTableMaterialSchema

    class Config:
        orm_mode = True


class AssemblyLayerSchema(BaseModel):
    id: int
    order: int
    assembly_id: int
    thickness_mm: float
    segments: list[AssemblyLayerSegmentSchema] = []

    class Config:
        orm_mode = True


class AssemblySchema(BaseModel):
    id: int
    name: str
    layers: list[AssemblyLayerSchema] = []

    class Config:
        orm_mode = True