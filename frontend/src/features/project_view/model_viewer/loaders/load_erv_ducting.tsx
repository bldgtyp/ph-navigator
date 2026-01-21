import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertLBTLineSegment3DtoLine } from '../to_three_geometry/ladybug_geometry/geometry3d/line';
import { hbPhHvacDuctElement } from '../types/honeybee_phhvac/ducting';
import { hbPhHvacVentilationSystem } from '../types/honeybee_phhvac/ventilation';

function addDuctSegments(ducting: hbPhHvacDuctElement[], targetGroup: THREE.Group) {
    ducting.forEach(duct => {
        for (const key in duct.segments) {
            const segment = duct.segments[key];
            const seg = convertLBTLineSegment3DtoLine(segment.geometry, false);
            const fl = new LineSegments2(seg, appMaterials.ductLine);
            fl.userData['type'] = 'ductSegmentLine';
            fl.userData['identifier'] = key;
            fl.userData['display_name'] = duct.display_name;
            fl.userData['duct_type'] = duct.duct_type;
            fl.userData['diameter'] = segment.diameter;
            fl.userData['insulation_thickness'] = segment.insulation_thickness;
            targetGroup.add(fl);
        }
    });
}

export function loadERVDucting(world: React.RefObject<SceneSetup>, data: hbPhHvacVentilationSystem[]) {
    data.forEach(erv_system => {
        addDuctSegments(erv_system.supply_ducting, world.current.ventilationGeometry);
        addDuctSegments(erv_system.exhaust_ducting, world.current.ventilationGeometry);
    });
    world.current.ventilationGeometry.visible = false;
}
