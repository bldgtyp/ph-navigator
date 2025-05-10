# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.ext.orderinglist import ordering_list
from database import Base

class Assembly(Base):
    __tablename__ = 'assemblies'

    id = Column(Integer, primary_key=True)
    name = Column(String)

    layers = relationship(
        "Layer",
        back_populates="assembly",
        order_by="Layer.order",
        collection_class=ordering_list('order')
    )
