import { SegmentType } from './Segment';

export interface LayerType {
    id: number;
    assembly_id: number;
    order: number;
    thickness_mm: number;
    segments: SegmentType[]
}