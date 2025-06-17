export interface LayerHeightModalType {
    isModalOpen: boolean;
    onModalClose: () => void;
    layerThickness: number;
    onLayerThicknessChange: (args: { thickness_mm: number }) => void;
    onSubmit: () => void;
    onDeleteLayer: () => void;
}
export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}
export interface HeightInputProps {
    layerThicknessUserInput: number;
    handleLayerThicknessUserInputChange: (args: { thickness_mm: number }) => void;
}
export interface DeleteButtonProps {
    handleDeleteLayer: () => void;
}
