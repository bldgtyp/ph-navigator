# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

import re

from pydantic import BaseModel, root_validator

from features.assembly.schemas.layer import AssemblyLayerSchema


class AssemblySchemaBase(BaseModel):
    """Base schema for Assembly."""

    name: str
    layers: list[AssemblyLayerSchema] = []

    class Config:
        orm_mode = True

    @property
    def is_steel_stud_assembly(self) -> bool:
        """Check if the assembly contains a steel stud layer."""
        return any([l.is_steel_stud_layer for l in self.layers])


class AssemblySchema(AssemblySchemaBase):
    """Schema for Assembly with ID."""

    id: int

    class Config:
        orm_mode = True


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


class DeleteAssemblyRequest(BaseModel):
    assembly_id: int

    @root_validator(pre=True)
    def check_assembly_id(cls, values):
        assembly_id = values.get("assembly_id")
        if not assembly_id:
            raise ValueError("Assembly ID is required.")
        return values
