import { lbtPoint3D } from "./pointvector";
import { lbtPlane } from "./plane";
import { lbtMesh3D } from "./mesh";

export type lbtFace3D = {
    type: string;
    boundary: lbtPoint3D[];
    plane: lbtPlane;
    mesh: lbtMesh3D | null;
    area: number | null;
};
