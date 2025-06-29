import { UpdatableInput } from '../../../../../../types/UpdatableInput';
import { MaterialType } from '../../_types/Material';

export interface LayerSegmentWidthModalProps {
    isModalOpen: boolean;
    segmentId: number;
    materialId: UpdatableInput<string, { materialId: string; materialColor: string }>;
    segmentWidthMM: UpdatableInput<number, { widthMM: number }>;
    steelStudChecked: UpdatableInput<boolean, { checked: boolean }>;
    steelStudSpacingMM: UpdatableInput<number, { steelStudSpacingMM: number }>;
    continuousInsulationChecked: UpdatableInput<boolean, { checked: boolean }>;
    onDeleteSegment: (segmentId: number) => void;
    onSubmit: () => void;
    onModalClose: () => void;
}

export interface DeleteButtonProps {
    segmentId: number; // ID of the segment being edited
    handleDeleteSegment: (segmentId: number) => void;
}

export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}

export interface WidthInputProps {
    widthMM: number;
    onSegmentWidthChange: (args: { widthMM: number }) => void;
}

export interface SteelStudSpacingInputProps {
    steelStudSpacing: number;
    onSteelStudSpacingChange: (args: { steelStudSpacingMM: number }) => void;
}

export interface MaterialInputProps {
    materialId: string;
    materialOptions: MaterialType[];
    selectedMaterial: MaterialType | null;
    isLoadingMaterials: boolean;
    handleMaterialChange: (args: { materialId: string; materialColor: string }) => void;
}

export interface MaterialDataDisplayProps {
    selectedMaterial: MaterialType | null;
}
