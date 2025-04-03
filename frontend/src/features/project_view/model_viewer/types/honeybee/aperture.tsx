import { lbtFace3D } from "../ladybug_geometry/geometry3d/face";
import { HoneybeeBoundaryCondition } from "./boundarycondition";
import { hbApertureProperties } from "./properties";

export type hbAperture = {
    type: string;
    identifier: string;
    face_type: string;
    display_name: string;
    geometry: lbtFace3D;
    boundary_condition: HoneybeeBoundaryCondition;
    properties: hbApertureProperties;
};
