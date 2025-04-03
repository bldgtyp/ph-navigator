import { lbtFace3D } from "../ladybug_geometry/geometry3d/face";
import { HoneybeeBoundaryCondition } from "./boundarycondition";
import { hbAperture } from "./aperture";
import { hbFaceProperties } from "./properties";

export type hbFace = {
    type: string;
    identifier: string;
    face_type: string;
    display_name: string;
    geometry: lbtFace3D;
    boundary_condition: HoneybeeBoundaryCondition;
    apertures: hbAperture[];
    // doors: any[],
    // indoor_shades: any[],
    // outdoor_shades: any[],
    properties: hbFaceProperties;
};
