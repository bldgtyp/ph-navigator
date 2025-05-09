import { Segment } from './Segment';

export interface Layer {
    id: number;
    assembly_id: number;
    order: number;
    thickness_mm: number;
    segments: Segment[]
}