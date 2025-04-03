import { lbtPolyline3D } from "../ladybug_geometry/geometry3d/polyline";
import { lbtLineSegment2D } from "../ladybug_geometry/geometry2d/line";
import { lbtArc3D } from "../ladybug_geometry/geometry3d/arc";
import { lbtArc2D } from "../ladybug_geometry/geometry2d/arc";
import { lbtPoint3D } from "../ladybug_geometry/geometry3d/pointvector";

type lbtCompass = {
    radius: number
    center: lbtPoint3D
    north_angle: number
    spacing_factor: number
    all_boundary_circles: lbtArc2D[]
    major_azimuth_ticks: lbtLineSegment2D[]
    minor_azimuth_ticks: lbtLineSegment2D[]
}

type lbtSunPath = {
    hourly_analemma_polyline3d: lbtPolyline3D[],
    monthly_day_arc3d: lbtArc3D[],
}

export type lbtSunPathDTO = {
    sunpath: lbtSunPath,
    compass: lbtCompass
};

