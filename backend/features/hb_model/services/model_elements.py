# -*- Python Version: 3.11 -*-

from collections import defaultdict
from logging import getLogger
from typing import Any, Iterable
from pydantic import ValidationError

from honeybee import face, room, shade
from honeybee.model import Model
from honeybee_energy.properties.face import FaceEnergyProperties
from honeybee_ph.properties.room import RoomPhProperties
from honeybee_phhvac.hot_water_system import PhHotWaterSystem
from honeybee_phhvac.properties.room import RoomPhHvacProperties
from honeybee_phhvac.ventilation import PhVentilationSystem
from ladybug import epw
from ladybug.compass import Compass
from ladybug.sunpath import Sunpath
from ladybug_geometry.geometry2d.pointvector import Point2D
from ladybug_geometry.geometry3d.mesh import Mesh3D
from ladybug_geometry.geometry3d.pointvector import Point3D

from ..schemas.honeybee.face import FaceSchema
from ..schemas.honeybee.shade import ShadeGroupSchema, ShadeSchema
from ..schemas.honeybee_energy.construction.opaque import OpaqueConstructionSchema
from ..schemas.honeybee_energy.construction.window import WindowConstructionSchema
from ..schemas.honeybee_ph.space import SpaceSchema
from ..schemas.honeybee_phhvac.hot_water_system import PhHotWaterSystemSchema
from ..schemas.honeybee_phhvac.ventilation import PhVentilationSystemSchema
from ..schemas.ladybug.compass import CompassSchema
from ..schemas.ladybug.sunpath import SunPathAndCompassDTOSchema, SunPathSchema
from ..schemas.ladybug_geometry.geometry2d.arc import Arc2D
from ..schemas.ladybug_geometry.geometry2d.line import LineSegment2D
from ..schemas.ladybug_geometry.geometry3d.arc import Arc3D
from ..schemas.ladybug_geometry.geometry3d.face3d import Mesh3DSchema
from ..schemas.ladybug_geometry.geometry3d.polyline import Polyline3D

logger = getLogger(__name__)


def any_dict(d: dict[Any, Any]) -> dict[Any, Any]:
    """Wrap un-typed LBT dictionaries (like 'to_dict()') to avoid type-checking errors."""
    return d


def get_faces_from_model(hb_model: Model) -> list:
    """Return a list of all the Faces from a Project's Honeybee-Model."""
    logger.info(f"get_faces_from_model({hb_model.display_name})")

    hb_faces: list[face.Face] = hb_model.faces

    face_dicts: list[FaceSchema] = []
    for hb_face in hb_faces:
        # -- Get the HB-Energy Construction and extra attributes
        # -- It may not be an AirBoundary or other Construction without materials, so guard against that.
        try:
            hb_face_energy_prop: FaceEnergyProperties = getattr(hb_face.properties, "energy")
            construction = OpaqueConstructionSchema(**any_dict(hb_face_energy_prop.construction.to_dict()))
        except ValidationError as e:
            logger.warning(f"Face {hb_face.display_name} construction '{hb_face_energy_prop.construction.display_name}' cannot be handled properly. Skipping.")
            continue
        
        face_DTO = FaceSchema(**any_dict(hb_face.to_dict()))

        # -- Note: Add the Mesh3D to each to the Faces
        face_DTO.geometry.mesh = Mesh3DSchema(**hb_face.punched_geometry.triangulated_mesh3d.to_dict())
        face_DTO.geometry.area = hb_face.punched_geometry.area

        # -- Assign the Construction and its attributes
        face_DTO.properties.energy.construction = construction
        face_DTO.properties.energy.construction.r_factor = getattr(hb_face_energy_prop.construction, "r_factor", 0.0)
        face_DTO.properties.energy.construction.u_factor = getattr(hb_face_energy_prop.construction, "u_factor", 0.0)
    
        # -- Get any additional Aperture data
        for aperture_DTO, hb_aperture in zip(face_DTO.apertures or [], hb_face.apertures or []):
            # -- Aperture Mesh Geometry
            aperture_DTO.geometry.mesh = Mesh3DSchema(**hb_aperture.geometry.triangulated_mesh3d.to_dict())
            aperture_DTO.geometry.area = hb_aperture.geometry.area

            # -- Aperture Construction
            ap_construction = WindowConstructionSchema(**hb_aperture.properties.energy.construction.to_dict())
            ap_construction.r_factor = hb_aperture.properties.energy.construction.r_factor
            ap_construction.u_factor = hb_aperture.properties.energy.construction.u_factor
            aperture_DTO.properties.energy.construction = ap_construction

        face_dicts.append(face_DTO)

    return face_dicts


def get_spaces_from_model(hb_model: Model) -> list:
    """Return a list of all the Spaces from a Project's Honeybee-Model."""
    logger.info(f"get_spaces_from_model({hb_model.display_name})")

    # -- Get all the interior spaces in the model
    hb_rooms: tuple[room.Room] = hb_model.rooms
    spaces: list[SpaceSchema] = []
    for hb_room in hb_rooms:
        room_prop_ph: RoomPhProperties = getattr(hb_room.properties, "ph")
        for space in room_prop_ph.spaces:
            space_DTO = SpaceSchema(**space.to_dict(include_mesh=True))
            space_DTO.net_volume = space.net_volume
            space_DTO.floor_area = space.floor_area
            space_DTO.weighted_floor_area = space.weighted_floor_area
            space_DTO.avg_clear_height = space.avg_clear_height
            space_DTO.average_floor_weighting_factor = space.average_floor_weighting_factor
            spaces.append(space_DTO)

    return spaces


def get_sun_path_from_model(epw_object: epw.EPW) -> SunPathAndCompassDTOSchema:
    """Return a list of all the Spaces from a Project's Honeybee-Model."""
    logger.info(f"get_sun_path_from_model({epw_object.location.city})")

    SCALE = 0.4
    NORTH = 0
    DAYLIGHT_SAVINGS_PERIOD = None
    CENTER_POINT = Point2D(0, 0)
    RADIUS: int = 100 * SCALE  # type: ignore # 'int' is a lie to placate the un-typed Ladybug functions...

    # -- Build the Ladybug SunPath and Compass
    sun_path = Sunpath.from_location(epw_object.location, NORTH, DAYLIGHT_SAVINGS_PERIOD)
    compass = Compass(RADIUS, CENTER_POINT, NORTH)

    # -- Setup the the SunPath DTO
    sunpath_DTO = SunPathSchema()
    sunpath_DTO.hourly_analemma_polyline3d = [
        Polyline3D(**_.to_dict()) for _ in sun_path.hourly_analemma_polyline3d(radius=RADIUS)
    ]
    sunpath_DTO.monthly_day_arc3d = [Arc3D(**_.to_dict()) for _ in sun_path.monthly_day_arc3d(radius=RADIUS)]

    # -- Setup the the Compass DTO
    compass_DTO = CompassSchema()
    compass_DTO.all_boundary_circles = [Arc2D(**_.to_dict()) for _ in compass.all_boundary_circles]
    compass_DTO.major_azimuth_ticks = [LineSegment2D(**_.to_dict()) for _ in compass.major_azimuth_ticks]
    compass_DTO.minor_azimuth_ticks = [LineSegment2D(**_.to_dict()) for _ in compass.minor_azimuth_ticks]

    sp = SunPathAndCompassDTOSchema(sunpath=sunpath_DTO, compass=compass_DTO)
    return sp


def get_hot_water_systems_from_model(
    hb_model: Model,
) -> list[PhHotWaterSystemSchema]:
    """Return a list of all the PH Hot-Water Systems from a Project's Honeybee-Model."""
    logger.info(f"get_hot_water_systems_from_model({hb_model.display_name})")

    # -- Get each unique Honeybee-PH-HVAC Hot-Water system in the HB-Model
    hb_phHvac_hw_systems: dict[str, PhHotWaterSystem] = {}
    for room in hb_model.rooms:
        room_prop_phhvac: RoomPhHvacProperties = getattr(room.properties, "ph_hvac")
        if not room_prop_phhvac.hot_water_system:
            continue
        hb_phHvac_hw_systems[room_prop_phhvac.hot_water_system.display_name] = room_prop_phhvac.hot_water_system

    # -- Convert the Honeybee-PH-HVAC Hot-Water systems to DTOs
    hw_system_DTOs: list[PhHotWaterSystemSchema] = []
    for hw_system in hb_phHvac_hw_systems.values():
        hw_system_DTOs.append(PhHotWaterSystemSchema(**hw_system.to_dict(_include_properties=True)))

    logger.info(f"Returning {len(hw_system_DTOs)} Hot Water Systems.")
    return hw_system_DTOs


def get_ventilation_systems_from_model(
    hb_model: Model,
) -> list[PhVentilationSystemSchema]:
    """Return a list of all the PH Ventilation Systems from a Project's Honeybee-Model."""
    logger.info(f"get_ventilation_systems_from_model({hb_model.display_name})")

    # -- Get each unique Ventilation system in the model
    ventilation_systems: dict[str, PhVentilationSystem] = {}
    for room in hb_model.rooms:
        room_prop_phhvac: RoomPhHvacProperties = getattr(room.properties, "ph_hvac")
        if not room_prop_phhvac.ventilation_system:
            continue
        ventilation_systems[room_prop_phhvac.ventilation_system.display_name] = room_prop_phhvac.ventilation_system

    # -- Convert the Ventilation systems to DTOs
    ventilation_system_DTOs: list[PhVentilationSystemSchema] = []
    for ventilation_system in ventilation_systems.values():
        ventilation_system_DTOs.append(PhVentilationSystemSchema(**ventilation_system.to_dict()))

    logger.info(f"Returning {len(ventilation_system_DTOs)} Ventilation Systems.")
    return ventilation_system_DTOs


def find_vertix_index(vertix_list: list[Point3D], vertix: Point3D) -> int:
    """Find the index of a vertix in a list of vertices.

    Note: this uses the Point3D.is_equivalent() method to compare the vertices
    instead of the __eq__ method in order to allow for a tolerance in the comparison.
    """
    TOL = 0.0000001
    for i, other_vert in enumerate(vertix_list):
        if vertix.is_equivalent(other_vert, TOL):
            return i
    raise ValueError()


def interpret_input_from_face_vertices(
    mesh_faces: Iterable[tuple[Point3D, Point3D, Point3D]],
) -> tuple[list[Point3D], list[tuple[int, ...]]]:
    """Custom version of the native LBT Mesh3D.from_face_vertices() method with custom `find_vertix_index` used."""

    vertices: list[Point3D] = []
    face_collector: list[tuple[int, ...]] = []

    # -- Create a list of vertices and faces from the input mesh_faces
    for mesh_face in mesh_faces:
        index_list: list[int] = []
        for mesh_vertix in mesh_face:
            try:  # try and use an existing vertix
                index_list.append(find_vertix_index(vertices, mesh_vertix))
            except ValueError:  # add new point
                vertices.append(mesh_vertix)
                index_list.append(len(vertices) - 1)

        # -- Add the new mesh-face
        face_collector.append(tuple(index_list))

    return vertices, face_collector


def get_shading_elements_from_model(hb_model: Model) -> list[ShadeGroupSchema]:
    """Return a list of all the Shading Element Groups from a Project's Honeybee-Model."""
    logger.info(f"get_shading_elements_from_model({hb_model.display_name})")

    # Group the shade faces by their display-name
    shade_groups = defaultdict(list[shade.Shade])
    hb_shades: list[shade.Shade] = hb_model.shades
    for shd in hb_shades:
        shade_groups[shd.display_name].append(shd)

    shade_DTOs: list[ShadeGroupSchema] = []
    number_of_shade_faces = 0
    for shade_group in shade_groups.values():
        if not shade_group:
            continue

        # -- Setup the DTO Outputs
        shade_group_DTO = ShadeGroupSchema()
        shade_DTO = ShadeSchema(**any_dict(shade_group[0].to_dict()))
        shade_group_DTO.shades.append(shade_DTO)
        shade_DTOs.append(shade_group_DTO)

        # -- Create a joined mesh for the shade group's faces
        face_vertices = (v for shd in shade_group for v in shd.geometry.triangulated_mesh3d.face_vertices)
        vertices, face_collector = interpret_input_from_face_vertices(face_vertices)
        joined_mesh = Mesh3D(tuple(vertices), tuple(face_collector))
        number_of_shade_faces += len(joined_mesh.faces)
        logger.debug(f"  > New Mesh: {len(joined_mesh.faces)}-faces {len(joined_mesh.vertices)}-vertices")

        # -- Update the DTO with the new mesh
        shade_DTO.geometry.mesh = Mesh3DSchema(**joined_mesh.to_dict())

    logger.info(f"Returning {number_of_shade_faces} shade-surfaces in {len(shade_DTOs)} groups.")
    return shade_DTOs
