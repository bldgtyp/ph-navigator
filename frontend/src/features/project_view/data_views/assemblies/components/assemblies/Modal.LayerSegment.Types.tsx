import { MaterialType } from "../../types/Material";

export interface LayerSegmentWidthModalProps {
    isModalOpen: boolean;
    widthMM: number; // Current width of the segment
    materialId: string; // Current material ID for the segment
    segmentId: number; // ID of the segment being edited
    handleWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteSegment: (segmentId: number) => void;
    handleMaterialChange: (materialId: string, materialColor: string) => void;
    handleSubmit: () => void;
    handleModalClose: () => void;
    // State for steel stud checkbox
    steelStudChecked: boolean;
    handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    // State for steel stud spacing
    steelStudSpacing: number;
    handleSteelStudSpacingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    // State for continuous insulation checkbox
    isConInsulationChecked: boolean;
    handleConInsulationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    handleWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface MaterialInputProps {
    materialId: string;
    materialOptions: MaterialType[];
    selectedMaterial: MaterialType | null;
    isLoadingMaterials: boolean;
    handleMaterialChange: (materialId: string, materialColor: string) => void;
}

export interface MaterialDataDisplayProps {
    selectedMaterial: MaterialType | null;
}
