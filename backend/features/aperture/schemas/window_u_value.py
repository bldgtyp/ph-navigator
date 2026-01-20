# -*- Python Version: 3.11 -*-

"""Response schema for window U-value calculation."""

from pydantic import BaseModel


class WindowUValueResponse(BaseModel):
    """Response schema for window U-value calculation per ISO 10077-1:2006."""

    u_value_w_m2k: float
    total_area_m2: float
    glazing_area_m2: float
    frame_area_m2: float
    heat_loss_glazing_w_k: float
    heat_loss_frame_w_k: float
    heat_loss_spacer_w_k: float
    is_valid: bool
    warnings: list[str]
    calculation_method: str
    includes_psi_install: bool

    class Config:
        orm_mode = True
