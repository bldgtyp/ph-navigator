import { MaterialType } from '../../types/Material';
import { SegmentType } from '../../types/Segment';

export interface MaterialDataProps {
    material: MaterialType | null;
}

export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}

export interface DetailsModalProps {
    isModalOpen: boolean;
    segment: SegmentType;
    currentNotes: string;
    handleModalClose: () => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    handleNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}
