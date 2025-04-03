import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertLBTLineSegment3DtoLine } from '../to_three_geometry/ladybug_geometry/geometry3d/line';
import { hbPhHvacHotWaterSystem } from "../types/honeybee_phhvac/hot_water_system";
import { hbPhHvacPipeTrunk } from '../types/honeybee_phhvac/hot_water_piping';

export function loadHotWaterPiping(world: React.RefObject<SceneSetup>, data: hbPhHvacHotWaterSystem[]) {
    data.forEach((hw_system) => {
        // -- Distribution piping -------------------------------------------------------
        for (const key in hw_system.distribution_piping) {
            // Build the Trunk Line
            const trunk: hbPhHvacPipeTrunk = hw_system.distribution_piping[key];
            const trunkGroup = new THREE.Group()
            trunkGroup.name = trunk.display_name
            trunkGroup.userData['identifier'] = trunk.identifier
            trunkGroup.userData['type'] = "pipeTrunkLine"
            world.current.pipeGeometry.add(trunkGroup)

            for (const key in trunk.branches) {
                // Build the Branch Line*                
                const branch = trunk.branches[key]
                const branchGroup = new THREE.Group()
                branchGroup.name = branch.display_name
                branchGroup.userData['identifier'] = branch.identifier
                branchGroup.userData['type'] = "pipeBranchLine"
                trunkGroup.add(branchGroup)

                for (const key in branch.fixtures) {
                    // Build the PipeElement
                    const pipeElement = branch.fixtures[key]
                    const pipeElementGroup = new THREE.Group()
                    pipeElementGroup.name = pipeElement.display_name
                    pipeElementGroup.userData['identifier'] = pipeElement.identifier
                    pipeElementGroup.userData['type'] = "pipeFixtureLine"
                    branchGroup.add(pipeElementGroup)

                    for (const key in pipeElement.segments) {
                        // Build the Pipe Segment
                        const segment = pipeElement.segments[key]
                        const line = convertLBTLineSegment3DtoLine(segment.geometry, false)
                        const thickLine = new LineSegments2(line, appMaterials.pipeLine);
                        thickLine.name = pipeElement.display_name
                        thickLine.userData['identifier'] = pipeElement.identifier
                        thickLine.userData['type'] = "pipeSegmentLine"
                        thickLine.userData['diameter_value'] = segment.diameter_value
                        thickLine.userData['insulation_thickness'] = segment.insulation_thickness
                        thickLine.userData['insulation_conductivity'] = segment.insulation_conductivity
                        thickLine.userData['insulation_reflective'] = segment.insulation_reflective
                        thickLine.userData['insulation_quality'] = segment.insulation_quality
                        thickLine.userData['daily_period'] = segment.daily_period
                        thickLine.userData['water_temp'] = segment.water_temp
                        thickLine.userData['material_value'] = segment.material_value
                        thickLine.userData['length'] = segment.length
                        pipeElementGroup.add(thickLine);
                    }
                }
            }
        }

        // -- Recirculation piping ------------------------------------------------------
        for (const key in hw_system.recirc_piping) {
            const fixture = hw_system.recirc_piping[key]
            for (const key in fixture.segments) {
                const segment = fixture.segments[key]
                const seg = convertLBTLineSegment3DtoLine(segment.geometry, false)
                const fl = new LineSegments2(seg, appMaterials.pipeLine);
                fl.userData['identifier'] = fixture.identifier
                fl.userData['type'] = "pipeRecircLineSegment"
                world.current.pipeGeometry.add(fl);
            }
        }
    });
    world.current.pipeGeometry.visible = false;
}