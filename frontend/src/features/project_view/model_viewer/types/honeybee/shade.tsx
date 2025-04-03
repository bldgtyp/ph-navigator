import { lbtFace3D } from "../ladybug_geometry/geometry3d/face";

export type hbShade = {
    type: string;
    identifier: string;
    display_name: string;
    is_detached: boolean;
    geometry: lbtFace3D;
};

export type hbShadeGroup = {
    shades: hbShade[];
};
