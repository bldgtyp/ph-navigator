export interface LayerHeightModalType {
    isModalOpen: boolean;
    handleModalClose: () => void;
    layerHeightMM: string;
    handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: () => void;
    handleDeleteLayer: () => void;
}
export interface OkCancelButtonsProps {
    handleModalClose: () => void;
}
export interface HeightInputProps {
    layerHeightInput: string;
    handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export interface DeleteButtonProps {
    handleDeleteLayer: () => void;
}
