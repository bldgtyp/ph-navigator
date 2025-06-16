import { MaterialType } from '../../types/Material';
import { SegmentType } from '../../types/Segment';

export interface MaterialDataProps {
    material: MaterialType | null;
}

export interface OkCancelButtonsProps {
    onModalClose: () => void;
}

export interface DetailsModalProps {
    isModalOpen: boolean;
    segment: SegmentType;
    currentNotes: string;
    onModalClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onNotesChange: (args: { notes: string }) => void;
}
