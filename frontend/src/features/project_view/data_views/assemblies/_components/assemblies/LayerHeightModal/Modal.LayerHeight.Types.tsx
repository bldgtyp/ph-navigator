export interface LayerHeightModalType {
    isModalOpen: boolean;
    onModalClose: () => void;
    layerThickness: number;
    onLayerThicknessChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: () => void;
    onDeleteLayer: () => void;
}
export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}
export interface HeightInputProps {
    layerThicknessUserInput: number;
    handleLayerThicknessUserInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export interface DeleteButtonProps {
    handleDeleteLayer: () => void;
}
