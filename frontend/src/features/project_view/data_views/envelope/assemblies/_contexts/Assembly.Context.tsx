import React, { createContext, useContext, useRef, useState } from 'react';
import { AssemblyType } from '../../_types/Assembly';

export interface AssemblyContextType {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    isRefreshing: boolean;
    setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
    refreshMessage: string | null;
    setRefreshMessage: React.Dispatch<React.SetStateAction<string | null>>;
    isLoadingAssemblies: boolean;
    setIsLoadingAssemblies: React.Dispatch<React.SetStateAction<boolean>>;
    assemblies: AssemblyType[];
    setAssemblies: React.Dispatch<React.SetStateAction<AssemblyType[]>>;
    selectedAssemblyId: number | null;
    setSelectedAssemblyId: React.Dispatch<React.SetStateAction<number | null>>;
}

const AssemblyContext = createContext<AssemblyContextType | undefined>(undefined);

export const AssemblyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);
    const [selectedAssemblyId, setSelectedAssemblyId] = useState<number | null>(null);

    return (
        <AssemblyContext.Provider
            value={{
                fileInputRef,
                isRefreshing,
                setIsRefreshing,
                refreshMessage,
                setRefreshMessage,
                isLoadingAssemblies,
                setIsLoadingAssemblies,
                assemblies,
                setAssemblies,
                selectedAssemblyId,
                setSelectedAssemblyId,
            }}
        >
            {children}
        </AssemblyContext.Provider>
    );
};

export const useAssembly = (): AssemblyContextType => {
    const context = useContext(AssemblyContext);
    if (!context) {
        throw new Error('useAssembly must be used within an AssemblyProvider');
    }
    return context;
};
