
from pydantic import BaseModel

class AirTightnessDataResponse(BaseModel):

    floor_area_m2: float
    envelope_area_m2: float
    net_volume_m3: float
    n_50_ACH: float # Volumetric air change rate at 50 Pa
    q_50_m3_hr_m2: float # Air permeability rate at 50 Pa
    air_leakage_m3_hr: float # Total air leakage at 50 Pa

    class Config:
        orm_mode = True
