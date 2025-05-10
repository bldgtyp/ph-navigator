export interface LayerHeightModalType {
    isModalOpen: boolean;
    handleModalClose: () => void;
    layerHeightMM: number;
    handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: () => void;
    handleDeleteLayer: () => void;
}
export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}
export interface HeightInputProps {
    layerHeightMM: number;
    handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export interface DeleteButtonProps {
    handleDeleteLayer: () => void;
}
