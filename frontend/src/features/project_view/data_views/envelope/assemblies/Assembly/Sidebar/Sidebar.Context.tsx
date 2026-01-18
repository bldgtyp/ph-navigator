import React, { createContext, useContext, useState } from 'react';
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

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    // Modal handling functions
    const openNameChangeModal = (id: number, name: string) => {
        setNameChangeModal({ isOpen: true, assemblyId: id, assemblyName: name });
    };

    const closeNameChangeModal = () => {
        setNameChangeModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleNameSubmit = (newName: string) => {
        handleNameChange(nameChangeModal.assemblyId, newName);
        closeNameChangeModal();
    };

    return (
        <AssemblySidebarContext.Provider
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
        </AssemblySidebarContext.Provider>
    );
};

export const useAssemblySidebar = (): AssemblySidebarContextType => {
    const context = useContext(AssemblySidebarContext);
    if (!context) {
        throw new Error('useAssemblySidebar must be used within an AssemblySidebarProvider');
    }
    return context;
};
