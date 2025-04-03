import { lbtPoint3D } from "./pointvector";

export type lbtMesh3D = {
    type: string;
    faces: number[];
    vertices: lbtPoint3D[];
};
