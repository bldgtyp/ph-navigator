import { lbtPlane } from "./plane";

export type lbtArc3D = {
    type: string;
    plane: lbtPlane;
    radius: number;
    a1: number;
    a2: number;
};
