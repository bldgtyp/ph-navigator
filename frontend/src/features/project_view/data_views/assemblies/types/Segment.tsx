import { MaterialType } from "./Material";

export enum SpecificationStatus {
    COMPLETE = "complete",
    MISSING = "missing",
    QUESTION = "question",
    NA = "na",
}

export interface SegmentType {
    id: number;
    layer_id: number;
    order: number;
    width_mm: number;
    material_id: string;
    material: MaterialType;
    steel_stud_spacing_mm: number | null;
    is_continuous_insulation: boolean;
    specification_status: SpecificationStatus;
    data_sheet_urls: string[];
    photo_urls: string[];
}