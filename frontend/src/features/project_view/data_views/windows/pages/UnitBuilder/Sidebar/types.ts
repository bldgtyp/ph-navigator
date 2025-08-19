import { ApertureType } from '../types';

export interface ApertureSidebarContextType {
    nameChangeModal: {
        isOpen: boolean;
        apertureId: number;
        apertureName: string;
    };
    setNameChangeModal: React.Dispatch<
        React.SetStateAction<{
            isOpen: boolean;
            apertureId: number;
            apertureName: string;
        }>
    >;
    openNameChangeModal: (id: any, name: string) => void;
    closeNameChangeModal: () => void;
    handleNameSubmit: (newName: string) => void;
}

export interface ApertureListItemContentProps {
    aperture: ApertureType;
    isSelected: boolean;
}
