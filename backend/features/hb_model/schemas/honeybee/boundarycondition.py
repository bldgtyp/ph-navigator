# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee.boundarycondition"""


from pydantic.main import BaseModel


class BoundaryConditionSchema(BaseModel):
    type: str

    def to_dict(self):
        """Convert the schema to a dictionary."""
        return {
            "type": self.type,
        }
