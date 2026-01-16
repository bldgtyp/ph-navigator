import { createContext, useContext, useState } from 'react';

import { useApertures } from '../../../_contexts/Aperture.Context';

import { ApertureSidebarContextType } from './types';

const ApertureSidebarContext = createContext<ApertureSidebarContextType | undefined>(undefined);

export const ApertureSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [nameChangeModal, setNameChangeModal] = useState({
        isOpen: false,
        apertureId: 0,
        apertureName: '',
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

    // Drawer toggle function
    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <ApertureSidebarContext.Provider
            value={{
                nameChangeModal,
                setNameChangeModal,
                openNameChangeModal,
                closeNameChangeModal,
                handleNameSubmit,
                isSidebarOpen,
                toggleSidebar,
            }}
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
