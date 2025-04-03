import { lbtLineSegment3D } from '../ladybug_geometry/geometry3d/line';

export type hbPhHvacDuctSegment = {
    geometry: lbtLineSegment3D;
    insulation_thickness: number;
    insulation_conductivity: number;
    insulation_reflective: boolean;
    diameter: number;
    height: number | null;
    width: number | null;
};

export type hbPhHvacDuctElement = {
    display_name: string;
    duct_type: number;
    segments: { [key: string]: hbPhHvacDuctSegment };
};
