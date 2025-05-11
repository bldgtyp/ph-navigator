# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references
import re 

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


class AddAssemblyRequest(BaseModel):
    project_bt_num: str

    @root_validator(pre=True)
    def check_project_id(cls, values):
        project_bt_num = values.get("project_bt_num")
        if not project_bt_num:
            raise ValueError("Project number is required.")
        return values

class DeleteAssemblyRequest(BaseModel):
    assembly_id: int

    @root_validator(pre=True)
    def check_assembly_id(cls, values):
        assembly_id = values.get("assembly_id")
        if not assembly_id:
            raise ValueError("Assembly ID is required.")
        return values

class UpdateAssemblyNameRequest(BaseModel):
    assembly_id: int
    new_name: str

    @root_validator(pre=True)
    def check_assembly_id(cls, values):
        assembly_id = values.get("assembly_id")
        if not assembly_id:
            raise ValueError("Assembly ID is required.")
        return values
    
    @root_validator(pre=True)
    def check_new_name(cls, values):
        new_name = values.get("new_name")
        if not new_name:
            raise ValueError("New name is required.")
        
        # Clean the name
        new_name = new_name.strip()  # Remove leading/trailing spaces
        new_name = " ".join(new_name.split())  # Normalize whitespace
            # Validate length
        if len(new_name) < 1:
            raise ValueError("New name must not be empty.")
        if len(new_name) > 100:
            raise ValueError("New name must not exceed 100 characters.")

        # Validate characters
        if not re.match(r"^[a-zA-Z0-9\s:\-[\],]+$", new_name):
            raise ValueError("New name contains invalid characters.")

        # Update the cleaned name back into the values
        values["new_name"] = new_name
        return values


class CreateLayerSegmentRequest(BaseModel):
    layer_id: int
    material_id: str
    width_mm: float
    order: int


class CreateLayerRequest(BaseModel):
    assembly_id: int
    thickness_mm: float
    order: int

    @root_validator(pre=True)
    def check_height(cls, values):
        thickness_mm = values.get("thickness_mm")
        if thickness_mm <= 0:
            raise ValueError("Layer thickness must be greater than 0.")
        return values


class UpdateSegmentMaterialRequest(BaseModel):
    material_id: str


class UpdateSegmentWidthRequest(BaseModel):
    width_mm: float

    @root_validator(pre=True)
    def check_width(cls, values):
        width_mm = values.get("width_mm")
        if width_mm <= 0:
            raise ValueError("Segment width must be greater than 0.")
        return values


class UpdateLayerHeightRequest(BaseModel):
    thickness_mm: float

    @root_validator(pre=True)
    def check_height(cls, values):
        thickness_mm = values.get("thickness_mm")
        if thickness_mm <= 0:
            raise ValueError("Layer thickness must be greater than 0.")
        return values


class AssemblyLayerSegmentSchema(BaseModel):
    id: int
    layer_id: int
    material_id: str
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