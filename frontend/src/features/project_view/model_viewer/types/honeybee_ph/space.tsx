import { lbtFace3D } from "../ladybug_geometry/geometry3d/face";

export type hbPhSpaceFloorSegment = {
    identifier: string;
    display_name: string;
    geometry: lbtFace3D | null;
    weighting_factor: number;
    weighted_floor_area: number;
    floor_area: number;
}

export type hbPhSpaceFloor = {
    identifier: string;
    display_name: string;
    geometry: lbtFace3D[];
    floor_segments: hbPhSpaceFloorSegment[];
};

export type hbPhSpaceVolume = {
    identifier: string;
    display_name: string;
    avg_ceiling_height: number;
    floor: hbPhSpaceFloor;
    geometry: lbtFace3D[];
};

export type hbPhSpace = {
    identifier: string;
    name: string;
    number: number;
    quantity: number;
    wufi_type: number;
    volumes: hbPhSpaceVolume[];
    properties: any;
    net_volume: number;
    avg_clear_height: number;
    floor_area: number;
    weighted_floor_area: number;
    average_floor_weighting_factor: number;
};