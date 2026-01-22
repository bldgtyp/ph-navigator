import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAssemblyContext } from '../Assembly.Context';

export interface AssemblySidebarContextType {
    nameChangeModal: {
        isOpen: boolean;
        assemblyId: number;
        assemblyName: string;
    };
    setNameChangeModal: React.Dispatch<
        React.SetStateAction<{
            isOpen: boolean;
            assemblyId: number;
            assemblyName: string;
        }>
    >;
    openNameChangeModal: (id: number, name: string) => void;
    closeNameChangeModal: () => void;
    handleNameSubmit: (newName: string) => void;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
}

const AssemblySidebarContext = createContext<AssemblySidebarContextType | undefined>(undefined);

export const AssemblySidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [nameChangeModal, setNameChangeModal] = useState({
        isOpen: false,
        assemblyId: 0,
        assemblyName: '',
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { handleNameChange } = useAssemblyContext();

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    // Modal handling functions
    const openNameChangeModal = useCallback((id: number, name: string) => {
        setNameChangeModal({ isOpen: true, assemblyId: id, assemblyName: name });
    }, []);

    const closeNameChangeModal = useCallback(() => {
        setNameChangeModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleNameSubmit = useCallback(
        (newName: string) => {
            handleNameChange(nameChangeModal.assemblyId, newName);
            closeNameChangeModal();
        },
        [handleNameChange, nameChangeModal.assemblyId, closeNameChangeModal]
    );

    const value = useMemo(
        () => ({
            nameChangeModal,
            setNameChangeModal,
            openNameChangeModal,
            closeNameChangeModal,
            handleNameSubmit,
            isSidebarOpen,
            toggleSidebar,
        }),
        [nameChangeModal, openNameChangeModal, closeNameChangeModal, handleNameSubmit, isSidebarOpen, toggleSidebar]
    );

    return <AssemblySidebarContext.Provider value={value}>{children}</AssemblySidebarContext.Provider>;
};

export const useAssemblySidebar = (): AssemblySidebarContextType => {
    const context = useContext(AssemblySidebarContext);
    if (!context) {
        throw new Error('useAssemblySidebar must be used within an AssemblySidebarProvider');
    }
    return context;
};
