import { lbtLineSegment3D } from '../ladybug_geometry/geometry3d/line';

type hbPhHvacPipeSegment = {
    geometry: lbtLineSegment3D;
    diameter_value: string;
    insulation_thickness: string;
    insulation_conductivity: number;
    insulation_reflective: boolean;
    insulation_quality: any;
    daily_period: number;
    water_temp: number;
    material_value: string;
    length: number;
};


export type hbPhHvacPipeElement = {
    identifier: string;
    display_name: string;
    user_data: Object;
    segments: { [key: string]: hbPhHvacPipeSegment; };
};


export type hbPhHvacPipeBranch = {
    identifier: string;
    display_name: string;
    pipe_element: hbPhHvacPipeElement;
    fixtures: { [key: string]: hbPhHvacPipeElement; };
    user_data: Object;

};

export type hbPhHvacPipeTrunk = {
    identifier: string;
    display_name: string;
    pipe_element: hbPhHvacPipeElement;
    branches: { [key: string]: hbPhHvacPipeBranch };
    multiplier: number;
    user_data: Object;
}


