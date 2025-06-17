import { MaterialType } from './Material';
import { MaterialPhotoType } from './Material.Photo';
import { MaterialDatasheetsType } from './Material.Datasheet';

export enum SpecificationStatus {
    COMPLETE = 'complete',
    MISSING = 'missing',
    QUESTION = 'question',
    NA = 'na',
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
    material_photos: MaterialPhotoType[];
    material_datasheets: MaterialDatasheetsType[];
    notes: string | null;
}
