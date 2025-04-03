import { lbtVector3D, lbtPoint3D } from "./pointvector";

export type lbtPlane = {
    type: string;
    n: lbtVector3D;
    o: lbtPoint3D;
    x: lbtVector3D;
};
