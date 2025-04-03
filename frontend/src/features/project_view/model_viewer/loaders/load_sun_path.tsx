import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertLBTPolyline3DtoLine } from '../to_three_geometry/ladybug_geometry/geometry3d/polyline';
import { convertLBTArc3DtoLine } from '../to_three_geometry/ladybug_geometry/geometry3d/arc';
import { convertLBTArc2DtoLine } from '../to_three_geometry/ladybug_geometry/geometry2d/arc';
import { convertLBTLineSegment2DtoLine } from '../to_three_geometry/ladybug_geometry/geometry2d/line';
import { lbtSunPathDTO } from "../types/ladybug/sunpath";

export function loadSunPath(world: React.RefObject<SceneSetup>, data: lbtSunPathDTO) {
    data.sunpath.hourly_analemma_polyline3d.forEach((lbtPolyline3D) => {
        const line = convertLBTPolyline3DtoLine(lbtPolyline3D)
        line.computeLineDistances(); // Dashes don't work without this
        line.material = appMaterials.sunpathLine;
        world.current.sunPathDiagram.add(line);
    });
    data.sunpath.monthly_day_arc3d.forEach((lbtArc3D) => {
        const line = convertLBTArc3DtoLine(lbtArc3D)
        line.material = appMaterials.sunpathLine;
        world.current.sunPathDiagram.add(line);
    });
    data.compass.all_boundary_circles.forEach((lbtArc2D) => {
        const arc1 = convertLBTArc2DtoLine(lbtArc2D)
        arc1.material = appMaterials.sunpathLine;
        world.current.sunPathDiagram.add(arc1);
    });
    data.compass.major_azimuth_ticks.forEach((lbtLineSegment2D) => {
        const line = convertLBTLineSegment2DtoLine(lbtLineSegment2D)
        line.material = appMaterials.sunpathLine;
        world.current.sunPathDiagram.add(line);
    });
    data.compass.minor_azimuth_ticks.forEach((lbtLineSegment2D) => {
        const line = convertLBTLineSegment2DtoLine(lbtLineSegment2D)
        line.material = appMaterials.sunpathLine;
        world.current.sunPathDiagram.add(line);
    });
    world.current.sunPathDiagram.visible = false;
}