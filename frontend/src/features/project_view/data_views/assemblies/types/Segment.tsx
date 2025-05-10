import { MaterialType } from "./Material";

export interface SegmentType {
    id: number;
    layer_id: number;
    order: number;
    width_mm: number;
    material_id: string;
    material: MaterialType;
}