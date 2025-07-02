import React, { createContext, useContext, useState } from 'react';
import { useApertures } from '../../_contexts/ApertureContext';

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

const ApertureSidebarContext = createContext<ApertureSidebarContextType | undefined>(undefined);

export const ApertureSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [nameChangeModal, setNameChangeModal] = useState({
        isOpen: false,
        apertureId: 0,
        apertureName: '',
    });

    const { handleNameChange } = useApertures();

    // Modal handling functions
    const openNameChangeModal = (id: number, name: string) => {
        setNameChangeModal({ isOpen: true, apertureId: id, apertureName: name });
    };

    const closeNameChangeModal = () => {
        setNameChangeModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleNameSubmit = (newName: string) => {
        handleNameChange(nameChangeModal.apertureId, newName);
        closeNameChangeModal();
    };

    return (
        <ApertureSidebarContext.Provider
            value={{ nameChangeModal, setNameChangeModal, openNameChangeModal, closeNameChangeModal, handleNameSubmit }}
        >
            {children}
        </ApertureSidebarContext.Provider>
    );
};

export const useApertureSidebar = (): ApertureSidebarContextType => {
    const context = useContext(ApertureSidebarContext);
    if (!context) {
        throw new Error('useApertureSidebar must be used within an ApertureSidebarProvider');
    }
    return context;
};
