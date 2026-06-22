"""Pydantic contracts for project-level location metadata."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.shared.models import strip_blank_string

MIN_ELEVATION_M = -500.0
MAX_ELEVATION_M = 9000.0


class LocationFields(BaseModel):
    """Nullable SI-canonical fields shared by writes and reads."""

    model_config = ConfigDict(extra="forbid")

    latitude: float | None = None
    longitude: float | None = None
    elevation_m: float | None = None
    time_zone: str | None = None
    true_north_deg: float | None = None
    site_address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=200)
    county: str | None = Field(default=None, max_length=200)
    county_fips: str | None = Field(default=None, max_length=5)
    country: str | None = Field(default=None, max_length=80)
    climate_zone: str | None = Field(default=None, max_length=10)
    geodata_provenance: dict[str, str] = Field(default_factory=dict)
    epw_asset_id: str | None = Field(default=None, max_length=200)
    epw_source_url: str | None = Field(default=None, max_length=1000)

    @field_validator(
        "site_address",
        "city",
        "state",
        "county",
        "county_fips",
        "country",
        "climate_zone",
        "epw_asset_id",
        "epw_source_url",
        mode="before",
    )
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return strip_blank_string(value)

    @field_validator("latitude")
    @classmethod
    def latitude_in_range(cls, value: float | None) -> float | None:
        return validate_latitude(value)

    @field_validator("longitude")
    @classmethod
    def longitude_in_range(cls, value: float | None) -> float | None:
        return validate_longitude(value)

    @field_validator("elevation_m")
    @classmethod
    def elevation_in_sane_range(cls, value: float | None) -> float | None:
        if value is not None and not MIN_ELEVATION_M <= value <= MAX_ELEVATION_M:
            raise ValueError(f"Elevation must be between {MIN_ELEVATION_M:g} and {MAX_ELEVATION_M:g} metres.")
        return value

    @field_validator("true_north_deg")
    @classmethod
    def true_north_in_range(cls, value: float | None) -> float | None:
        if value is not None and not 0 <= value < 360:
            raise ValueError("True north must be greater than or equal to 0 and less than 360 degrees.")
        return value

    @field_validator("time_zone")
    @classmethod
    def time_zone_is_iana(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Time zone must be a valid IANA time zone.") from exc
        return value


class UpdateProjectLocationRequest(BaseModel):
    """Partial update payload; omitted fields are left unchanged."""

    model_config = ConfigDict(extra="forbid")

    latitude: float | None = None
    longitude: float | None = None
    elevation_m: float | None = None
    time_zone: str | None = None
    true_north_deg: float | None = None
    site_address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=200)
    epw_asset_id: str | None = Field(default=None, max_length=200)
    epw_source_url: str | None = Field(default=None, max_length=1000)

    @field_validator("site_address", "city", "state", "epw_asset_id", "epw_source_url", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return strip_blank_string(value)

    @field_validator("latitude")
    @classmethod
    def latitude_in_range(cls, value: float | None) -> float | None:
        return validate_latitude(value)

    @field_validator("longitude")
    @classmethod
    def longitude_in_range(cls, value: float | None) -> float | None:
        return validate_longitude(value)

    @field_validator("elevation_m")
    @classmethod
    def elevation_in_sane_range(cls, value: float | None) -> float | None:
        if value is not None and not MIN_ELEVATION_M <= value <= MAX_ELEVATION_M:
            raise ValueError(f"Elevation must be between {MIN_ELEVATION_M:g} and {MAX_ELEVATION_M:g} metres.")
        return value

    @field_validator("true_north_deg")
    @classmethod
    def true_north_in_range(cls, value: float | None) -> float | None:
        if value is not None and not 0 <= value < 360:
            raise ValueError("True north must be greater than or equal to 0 and less than 360 degrees.")
        return value

    @field_validator("time_zone")
    @classmethod
    def time_zone_is_iana(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Time zone must be a valid IANA time zone.") from exc
        return value


class RequiredCoordinatesRequest(BaseModel):
    """Required WGS84 coordinates with shared range validation."""

    model_config = ConfigDict(extra="forbid")

    latitude: float
    longitude: float

    @field_validator("latitude")
    @classmethod
    def latitude_in_range(cls, value: float) -> float:
        validated = validate_latitude(value)
        if validated is None:
            raise ValueError("Latitude is required.")
        return validated

    @field_validator("longitude")
    @classmethod
    def longitude_in_range(cls, value: float) -> float:
        validated = validate_longitude(value)
        if validated is None:
            raise ValueError("Longitude is required.")
        return validated


class DeriveProjectLocationRequest(RequiredCoordinatesRequest):
    """Coordinates to use for server-side location geodata derivation."""

    site_address: str | None = Field(default=None, max_length=500)

    @field_validator("site_address", mode="before")
    @classmethod
    def strip_blank_address(cls, value: object) -> object:
        return strip_blank_string(value)


class ElevationLookupRequest(RequiredCoordinatesRequest):
    """Coordinates for a stateless site-elevation lookup (no persistence)."""


class ElevationLookupResponse(BaseModel):
    """Elevation suggestion for the Set Location modal's auto-fill.

    `elevation_m` is null when neither provider answered; `warning` then carries
    the human-readable reason so the editor can fall back to manual entry.
    """

    model_config = ConfigDict(extra="forbid")

    elevation_m: float | None = None
    source: str | None = None
    warning: str | None = None


class GeocodeProjectLocationRequest(BaseModel):
    """Address text to resolve through the configured geocoder."""

    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=500)

    @field_validator("query", mode="before")
    @classmethod
    def strip_query(cls, value: object) -> object:
        return strip_blank_string(value)


class GeocodeProjectLocationCandidate(BaseModel):
    """Address candidate returned by the project-location geocoder."""

    model_config = ConfigDict(extra="forbid")

    label: str
    latitude: float
    longitude: float
    site_address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    source: str


class GeocodeProjectLocationResponse(BaseModel):
    """Geocoder response for an editor-reviewed address selection."""

    model_config = ConfigDict(extra="forbid")

    candidates: list[GeocodeProjectLocationCandidate]


class EpwParsedLocation(BaseModel):
    """Parsed EPW header snapshot retained for future climate consumers."""

    model_config = ConfigDict(extra="forbid")

    latitude: float | None = None
    longitude: float | None = None
    elevation_m: float | None = None
    time_zone: str | None = None
    time_zone_offset_hours: float | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    source: str | None = None
    wmo: str | None = None


class EpwParseResponse(BaseModel):
    """Parsed EPW location suggestion for a user-reviewed apply action."""

    model_config = ConfigDict(extra="forbid")

    asset_id: str
    filename: str
    suggestion: EpwParsedLocation


class EpwDescriptor(BaseModel):
    """Resolved descriptor for the primary linked EPW asset."""

    model_config = ConfigDict(extra="forbid")

    id: str
    filename: str | None = None
    source_url: str | None = None
    parsed_location: EpwParsedLocation | None = None


class ProjectLocation(LocationFields):
    """Read model for one project's saved location."""

    is_set: bool
    updated_at: datetime | None = None
    epw: EpwDescriptor | None = None


class ProjectLocationUpdateResponse(BaseModel):
    """Location write response with Phase 3 warning plumbing."""

    model_config = ConfigDict(extra="forbid")

    location: ProjectLocation
    warnings: list[str] = Field(default_factory=list)


def validate_latitude(value: float | None) -> float | None:
    if value is not None and not -90 <= value <= 90:
        raise ValueError("Latitude must be between -90 and 90 degrees.")
    return value


def validate_longitude(value: float | None) -> float | None:
    if value is not None and not -180 <= value <= 180:
        raise ValueError("Longitude must be between -180 and 180 degrees.")
    return value
