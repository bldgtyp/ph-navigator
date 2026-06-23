"""P3 EPW/STAT and ASHRAE design-condition substrate tests."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from features.climate.ashrae_meteo import design_conditions_from_ashrae_station
from features.climate.epw_catalog import (
    EpwCatalogEntry,
    epw_version_label,
    epw_zip_payload,
    parse_epw_catalog_xlsx,
)
from features.climate.stat_parser import parse_stat_file

STAT_SAMPLE = """
Statistics for USA_MA_Pittsfield.Muni.AP.744104_TMYx.2011-2025
Location -- Pittsfield.Muni.AP MA USA
WMO Station 744104
- Displaying Design Conditions from "2025 ASHRAE Handbook -- Fundamentals - Chapter 14 Climatic Design Information"
\tHeating\t1\t-18.8\t-16.0\t-24.7\t0.4\t-17.3\t-22.1\t0.5\t-14.9\t11.3\t-5.3\t10.3\t-6.3\t3.1\t300\t0.511
\tCooling\t7\t10.8\t29.9\t21.6\t28.5\t20.8\t27.2\t20.2\t23.0\t27.9\t22.2\t26.6\t21.4\t25.4\t3.7\t220\t21.3\t16.7\t25.5\t20.8\t16.1\t24.8\t20.0\t15.3
\tExtremes\t9.7\t8.2\t7.1\t-22.9\t32.3\t-23.1\t24.5
\tHDD base 18.3C\t726\t624\t550\t328\t162\t50\t8\t18\t91\t267\t444\t616
\tCDD base 10C\t1\t1\t3\t28\t122\t235\t337\t306\t180\t53\t8\t1
"""


def test_stat_parser_extracts_degree_days_extremes_and_design_conditions() -> None:
    parsed = parse_stat_file(STAT_SAMPLE)

    assert parsed.station_name == "Pittsfield.Muni.AP MA USA"
    assert parsed.wmo == "744104"
    assert parsed.metrics.hdd65_f_days == 3884
    assert parsed.metrics.cdd50_f_days == 1275
    assert parsed.metrics.record_low_c == -22.9
    assert parsed.metrics.record_high_c == 32.3
    assert (
        parsed.design_conditions.edition
        == "2025 ASHRAE Handbook -- Fundamentals - Chapter 14 Climatic Design Information"
    )
    assert parsed.design_conditions.heating_996_db_c == -18.8
    assert parsed.design_conditions.heating_990_db_c == -16.0
    # Cooling DB/MCWB across the three annual percentiles (0.4% / 1% / 2%).
    assert parsed.design_conditions.cooling_004_db_c == 29.9
    assert parsed.design_conditions.cooling_004_mcwb_c == 21.6
    assert parsed.design_conditions.cooling_010_db_c == 28.5
    assert parsed.design_conditions.cooling_010_mcwb_c == 20.8
    assert parsed.design_conditions.cooling_020_db_c == 27.2
    assert parsed.design_conditions.cooling_020_mcwb_c == 20.2
    assert parsed.design_conditions.dehumidification_010_dp_c == 20.8
    assert parsed.design_conditions.dehumidification_010_mcdb_c == 24.8
    assert parsed.metrics.missing_fields == []
    assert parsed.design_conditions.missing_fields == []


def test_stat_parser_flags_missing_fields() -> None:
    parsed = parse_stat_file("Location -- Missing\nWMO Station 000001\n")

    assert "hdd65_f_days" in parsed.metrics.missing_fields
    assert "heating_996_db_c" in parsed.design_conditions.missing_fields


def test_epw_catalog_xlsx_parses_and_ranks_with_haversine() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(
        [
            "Country",
            "State",
            "City/Station",
            "WMO",
            "Source Data",
            "Latitude (N+/S-)",
            "Longitude (E+/W-)",
            "Time Zone (GMT +/-)",
            "Elevation (m)",
            "URL",
        ]
    )
    sheet.append(["USA", "MA", "Pittsfield.Muni.AP", 744104, "SRC-TMYx", 42.427, -73.289, -5, 364, "pitts.zip"])
    buffer = BytesIO()
    workbook.save(buffer)

    entries = parse_epw_catalog_xlsx(buffer.getvalue(), base_url="https://climate.onebuilding.org/sources/")

    assert entries == [
        EpwCatalogEntry(
            country="USA",
            region="MA",
            name="Pittsfield.Muni.AP",
            wmo="744104",
            source_data="SRC-TMYx",
            latitude=42.427,
            longitude=-73.289,
            elevation_m=364,
            time_zone_offset_hours=-5,
            url="https://climate.onebuilding.org/sources/pitts.zip",
        )
    ]


def test_epw_version_label_parses_type_and_period() -> None:
    base = "https://climate.onebuilding.org/sources/USA_MA_Pittsfield.Muni.AP.744104"
    # Period spans render type + en-dashed years; the bare TMYx/TMY3 files render just the type.
    assert epw_version_label(f"{base}_TMYx.2009-2023.zip") == "TMYx 2009–2023"
    assert epw_version_label(f"{base}_TMYx.zip") == "TMYx"
    assert epw_version_label(f"{base}_TMY3.zip") == "TMY3"
    # Off-convention names fall back rather than mislabel.
    assert epw_version_label("https://example.org/pitts.zip") == "EPW"


def test_epw_zip_payload_extracts_epw_and_stat() -> None:
    entry = EpwCatalogEntry(
        country="USA",
        region="MA",
        name="Pittsfield.Muni.AP",
        wmo="744104",
        source_data="SRC-TMYx",
        latitude=42.427,
        longitude=-73.289,
        elevation_m=364,
        time_zone_offset_hours=-5,
        url="https://climate.onebuilding.org/test.zip",
    )
    buffer = BytesIO()
    import zipfile

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("station.epw", "LOCATION,Pittsfield,MA,USA,TMYx,744104,42.427,-73.289,-5,364\n")
        archive.writestr("station.stat", STAT_SAMPLE)

    payload = epw_zip_payload(entry, buffer.getvalue())

    assert payload.epw_name == "station.epw"
    assert payload.stat_name == "station.stat"
    assert "Pittsfield.Muni.AP" in (payload.stat_text or "")


def test_ashrae_meteo_station_mapping_supports_recorded_fixture_shape() -> None:
    design = design_conditions_from_ashrae_station(
        {
            "wmo": "744104",
            "place": "PITTSFIELD MUNI AP",
            "heating_DB_996": "-18.8",
            "heating_DB_990": "-16.0",
            "cooling_DB_MCWB_0_4_DB": "29.9",
            "cooling_DB_MCWB_0_4_MCWB": "21.6",
            "cooling_DB_MCWB_1_DB": "28.5",
            "cooling_DB_MCWB_1_MCWB": "20.8",
            "cooling_DB_MCWB_2_DB": "27.2",
            "cooling_DB_MCWB_2_MCWB": "20.2",
            "dehumidification_DP_MCDB_1_DP": "20.8",
            "dehumidification_DP_MCDB_1_MCDB": "24.8",
            "extreme_annual_DB_min": "-22.9",
            "extreme_annual_DB_max": "32.3",
        },
        ashrae_version="2025",
    )

    assert design.basis == "ASHRAE Meteo 2025 / PITTSFIELD MUNI AP"
    assert design.cooling_004_db_c == 29.9
    assert design.cooling_010_db_c == 28.5
    assert design.cooling_020_db_c == 27.2
    assert design.missing_fields == []
