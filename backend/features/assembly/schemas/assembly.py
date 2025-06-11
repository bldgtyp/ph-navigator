# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, root_validator

from features.assembly.schemas.layer import LayerSchema
from honeybee.typing import clean_ep_string

class AssemblySchemaBase(BaseModel):
    """Base schema for Assembly."""

    name: str
    layers: list[LayerSchema] = []

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
    new_name: str

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
        try:
            new_name = clean_ep_string(new_name)
        except Exception as e:
            raise ValueError(f"New name is not valid.\n{e}")

        # Update the cleaned name back into the values
        values["new_name"] = new_name
        return values
