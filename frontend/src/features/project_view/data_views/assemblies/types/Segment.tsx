import { Material } from "./Material";

export interface Segment {
    id: number;
    layer_id: number;
    order: number;
    material_id: number;
    width_mm: number;
    material: Material;
}