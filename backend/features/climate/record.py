"""The standardized climate record (`ClimateRecord`).

One canonical, SI-canonical schema that every climate source (Phius
``-mon.txt``, PHI/PHPP xlsx, EPW-derived, ASHRAE, custom) normalizes
into. It is **pinned to mirror** ``honeybee_ph.site.Site`` (PRD §4.3,
research.md / D-CL-10) so it round-trips losslessly into HBJSON / PHX /
PHPP / WUFI via the existing ``Site.to_dict()`` / ``Site.from_dict()``.

We deliberately do **not** subclass the py2.7 ``honeybee_ph`` classes.
Instead we mirror the dict shape with clean Pydantic v2 models and bridge
through :meth:`ClimateRecord.from_honeybee_ph_site` /
:meth:`ClimateRecord.to_honeybee_ph_site`. The bridge is what keeps this
module honeybee_ph-compatible without inheriting its IronPython quirks
(type comments, old-style classes, month-keyed value dicts).

Units mirror ``honeybee_ph`` verbatim: monthly radiation kWh/m²;
peak-load radiation W/m²; temperatures °C; elevation m; wind m/s; daily
swing K. Internally we store each monthly quantity as an ordered
12-element list (Jan…Dec); honeybee_ph stores month-keyed dicts, and the
bridge converts between the two.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

# honeybee_ph serializes each monthly value set as a dict keyed by month
# name. The order here is load-bearing: it defines the Jan…Dec ordering
# of our internal 12-element lists.
_MONTHS: tuple[str, ...] = (
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
)

# Namespace under which the source-specific `aux` block round-trips
# through honeybee_ph's `user_data` (honeybee_ph has no native home for
# degree-hours, Jan/Jul wind, albedo, etc.).
_AUX_USER_DATA_KEY = "ph_navigator_climate_aux"

# A length-12 monthly series (Jan…Dec), SI units per the owning field.
Monthly12 = Annotated[list[float], Field(min_length=12, max_length=12)]


def _months_to_list(value_set: dict[str, Any]) -> list[float]:
    """Project a honeybee_ph month-keyed value-set dict to a Jan…Dec list."""
    return [float(value_set[month]) for month in _MONTHS]


def _list_to_months(values: list[float]) -> dict[str, float]:
    """Inverse of :func:`_months_to_list` — a honeybee_ph value-set body."""
    return {month: float(values[index]) for index, month in enumerate(_MONTHS)}


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ClimateLocation(_Base):
    """Geographic site data — mirrors ``honeybee_ph.site.Location``."""

    latitude: float
    longitude: float
    site_elevation_m: float | None = None
    climate_zone: int = 1
    hours_from_utc: int = 0


class ClimatePhppCodes(_Base):
    """PHPP library identity — mirrors ``honeybee_ph.site.PHPPCodes``.

    This triple is exactly the "pick a PHPP/PHI location from a dropdown"
    identity (D-CL-4 / D-CL-8).
    """

    country_code: str = ""
    region_code: str = ""
    dataset_name: str = ""


class ClimateGround(_Base):
    """Ground thermal properties — mirrors ``honeybee_ph.site.Climate_Ground``."""

    thermal_conductivity: float = 2.0
    heat_capacity: float = 1000.0
    density: float = 2000.0
    depth_groundwater_m: float = 3.0
    flow_rate_groundwater: float = 0.05


class ClimateMonthlyTemps(_Base):
    """Monthly temperatures (°C) — mirrors ``Climate_MonthlyTempCollection``."""

    air_c: Monthly12
    dewpoint_c: Monthly12
    sky_c: Monthly12
    ground_c: Monthly12


class ClimateMonthlyRadiation(_Base):
    """Monthly radiation (kWh/m²) — mirrors ``Climate_MonthlyRadiationCollection``.

    ``glob`` is global horizontal radiation; the name mirrors
    honeybee_ph's ``glob`` key (``global`` is a Python keyword) so the
    bridge stays a trivial pass-through.
    """

    north: Monthly12
    east: Monthly12
    south: Monthly12
    west: Monthly12
    glob: Monthly12


class ClimatePeakLoad(_Base):
    """One design condition — mirrors ``honeybee_ph.site.Climate_PeakLoadValueSet``.

    Radiation values are W/m² (instantaneous design load), unlike the
    monthly kWh/m² series.
    """

    temp_c: float = 0.0
    rad_north: float = 0.0
    rad_east: float = 0.0
    rad_south: float = 0.0
    rad_west: float = 0.0
    rad_global: float = 0.0
    dewpoint_c: float | None = None
    sky_c: float | None = None
    ground_c: float | None = None


class ClimatePeakLoads(_Base):
    """The four design conditions — mirrors ``Climate_PeakLoadCollection``."""

    heat_load_1: ClimatePeakLoad = Field(default_factory=ClimatePeakLoad)
    heat_load_2: ClimatePeakLoad = Field(default_factory=ClimatePeakLoad)
    cooling_load_1: ClimatePeakLoad = Field(default_factory=ClimatePeakLoad)
    cooling_load_2: ClimatePeakLoad = Field(default_factory=ClimatePeakLoad)


class ClimateData(_Base):
    """The climate payload — mirrors ``honeybee_ph.site.Climate``."""

    station_elevation_m: float = 0.0
    summer_daily_temperature_swing_k: float = 8.0
    average_wind_speed_ms: float = 4.0
    ground: ClimateGround = Field(default_factory=ClimateGround)
    monthly_temps: ClimateMonthlyTemps
    monthly_radiation: ClimateMonthlyRadiation
    peak_loads: ClimatePeakLoads = Field(default_factory=ClimatePeakLoads)


class ClimateAux(_Base):
    """Source fields ``honeybee_ph`` omits (it keeps these in ``user_data``).

    Everything optional: not every source supplies every field (the
    Phius ``-mon.txt`` does; EPW-derived and custom records may not).
    """

    heating_degree_hours_12_20: float | None = None
    cooling_degree_hours_24: float | None = None
    wind_speed_jan_ms: float | None = None
    wind_speed_jul_ms: float | None = None
    temp_min_12h_c: float | None = None
    summer_night_fraction_dry_pct: float | None = None
    summer_night_fraction_humid_pct: float | None = None
    albedo: float | None = None


class ClimateRecord(_Base):
    """The standardized climate record (PRD §4.3).

    Mirrors ``honeybee_ph.site.Site`` for the core (``location`` /
    ``climate`` / ``phpp_codes``), plus our reference-dataset identity
    (``provider`` / ``version`` / ``station_id``) and the ``aux``
    extension block.
    """

    display_name: str = ""
    provider: str | None = None
    version: str | None = None
    station_id: str | None = None
    phpp_codes: ClimatePhppCodes = Field(default_factory=ClimatePhppCodes)
    location: ClimateLocation
    climate: ClimateData
    aux: ClimateAux = Field(default_factory=ClimateAux)

    # --- honeybee_ph bridge ------------------------------------------------

    @classmethod
    def from_honeybee_ph_site(cls, site_dict: dict[str, Any]) -> ClimateRecord:
        """Build a record from a ``honeybee_ph.site.Site.to_dict()`` payload."""
        location = site_dict["location"]
        climate = site_dict["climate"]
        temps = climate["monthly_temps"]
        radiation = climate["monthly_radiation"]
        peaks = climate["peak_loads"]
        ground = climate.get("ground", {})
        aux_raw = site_dict.get("user_data", {}).get(_AUX_USER_DATA_KEY, {})

        return cls(
            display_name=site_dict.get("display_name", ""),
            provider=aux_raw.get("provider"),
            version=aux_raw.get("version"),
            station_id=aux_raw.get("station_id"),
            phpp_codes=ClimatePhppCodes(
                country_code=site_dict["phpp_library_codes"].get("country_code", ""),
                region_code=site_dict["phpp_library_codes"].get("region_code", ""),
                dataset_name=site_dict["phpp_library_codes"].get("dataset_name", ""),
            ),
            location=ClimateLocation(
                latitude=location["latitude"],
                longitude=location["longitude"],
                site_elevation_m=location.get("site_elevation"),
                climate_zone=location.get("climate_zone", 1),
                hours_from_utc=location.get("hours_from_UTC", 0),
            ),
            climate=ClimateData(
                station_elevation_m=climate["station_elevation"],
                summer_daily_temperature_swing_k=climate["summer_daily_temperature_swing"],
                average_wind_speed_ms=climate["average_wind_speed"],
                ground=ClimateGround(
                    thermal_conductivity=ground.get("ground_thermal_conductivity", 2.0),
                    heat_capacity=ground.get("ground_heat_capacity", 1000.0),
                    density=ground.get("ground_density", 2000.0),
                    depth_groundwater_m=ground.get("depth_groundwater", 3.0),
                    flow_rate_groundwater=ground.get("flow_rate_groundwater", 0.05),
                ),
                monthly_temps=ClimateMonthlyTemps(
                    air_c=_months_to_list(temps["air_temps"]),
                    dewpoint_c=_months_to_list(temps["dewpoints"]),
                    sky_c=_months_to_list(temps["sky_temps"]),
                    ground_c=_months_to_list(temps["ground_temps"]),
                ),
                monthly_radiation=ClimateMonthlyRadiation(
                    north=_months_to_list(radiation["north"]),
                    east=_months_to_list(radiation["east"]),
                    south=_months_to_list(radiation["south"]),
                    west=_months_to_list(radiation["west"]),
                    glob=_months_to_list(radiation["glob"]),
                ),
                peak_loads=ClimatePeakLoads(
                    heat_load_1=_peak_from_dict(peaks["heat_load_1"]),
                    heat_load_2=_peak_from_dict(peaks["heat_load_2"]),
                    cooling_load_1=_peak_from_dict(peaks["cooling_load_1"]),
                    cooling_load_2=_peak_from_dict(peaks["cooling_load_2"]),
                ),
            ),
            aux=ClimateAux.model_validate(
                {key: value for key, value in aux_raw.items() if key in ClimateAux.model_fields}
            ),
        )

    def to_honeybee_ph_site(self) -> dict[str, Any]:
        """Render a payload ``honeybee_ph.site.Site.from_dict()`` accepts.

        Our identity (``provider``/``version``/``station_id``) and the
        ``aux`` block have no native home in honeybee_ph, so they are
        stashed under ``user_data[_AUX_USER_DATA_KEY]`` — which is exactly
        how honeybee_ph itself carries non-core fields, keeping the
        round-trip lossless.
        """
        rad = self.climate.monthly_radiation
        temps = self.climate.monthly_temps
        peaks = self.climate.peak_loads
        aux_payload = {
            **self.aux.model_dump(),
            "provider": self.provider,
            "version": self.version,
            "station_id": self.station_id,
        }
        return {
            "display_name": self.display_name,
            "user_data": {_AUX_USER_DATA_KEY: aux_payload},
            "phpp_library_codes": {
                "country_code": self.phpp_codes.country_code,
                "region_code": self.phpp_codes.region_code,
                "dataset_name": self.phpp_codes.dataset_name,
            },
            "location": {
                "latitude": self.location.latitude,
                "longitude": self.location.longitude,
                "site_elevation": self.location.site_elevation_m,
                "climate_zone": self.location.climate_zone,
                "hours_from_UTC": self.location.hours_from_utc,
            },
            "climate": {
                "station_elevation": self.climate.station_elevation_m,
                "summer_daily_temperature_swing": self.climate.summer_daily_temperature_swing_k,
                "average_wind_speed": self.climate.average_wind_speed_ms,
                "ground": {
                    "ground_thermal_conductivity": self.climate.ground.thermal_conductivity,
                    "ground_heat_capacity": self.climate.ground.heat_capacity,
                    "ground_density": self.climate.ground.density,
                    "depth_groundwater": self.climate.ground.depth_groundwater_m,
                    "flow_rate_groundwater": self.climate.ground.flow_rate_groundwater,
                },
                "monthly_temps": {
                    "air_temps": _list_to_months(temps.air_c),
                    "dewpoints": _list_to_months(temps.dewpoint_c),
                    "sky_temps": _list_to_months(temps.sky_c),
                    "ground_temps": _list_to_months(temps.ground_c),
                },
                "monthly_radiation": {
                    "north": _list_to_months(rad.north),
                    "east": _list_to_months(rad.east),
                    "south": _list_to_months(rad.south),
                    "west": _list_to_months(rad.west),
                    "glob": _list_to_months(rad.glob),
                },
                "peak_loads": {
                    "heat_load_1": _peak_to_dict(peaks.heat_load_1),
                    "heat_load_2": _peak_to_dict(peaks.heat_load_2),
                    "cooling_load_1": _peak_to_dict(peaks.cooling_load_1),
                    "cooling_load_2": _peak_to_dict(peaks.cooling_load_2),
                },
            },
        }


def _peak_from_dict(peak: dict[str, Any]) -> ClimatePeakLoad:
    return ClimatePeakLoad(
        temp_c=peak["temp"],
        rad_north=peak["rad_north"],
        rad_east=peak["rad_east"],
        rad_south=peak["rad_south"],
        rad_west=peak["rad_west"],
        rad_global=peak["rad_global"],
        dewpoint_c=peak.get("dewpoint"),
        sky_c=peak.get("sky_temp"),
        ground_c=peak.get("ground_temp"),
    )


def _peak_to_dict(peak: ClimatePeakLoad) -> dict[str, Any]:
    return {
        "temp": peak.temp_c,
        "rad_north": peak.rad_north,
        "rad_east": peak.rad_east,
        "rad_south": peak.rad_south,
        "rad_west": peak.rad_west,
        "rad_global": peak.rad_global,
        "dewpoint": peak.dewpoint_c,
        "sky_temp": peak.sky_c,
        "ground_temp": peak.ground_c,
    }
