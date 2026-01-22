import { createContext, useContext, useState } from 'react';
import { HBModelMetadata } from '../types/model_metadata';

// Context type definition
type SelectedModelContextType = {
    availableModels: HBModelMetadata[];
    setAvailableModels: React.Dispatch<React.SetStateAction<HBModelMetadata[]>>;
    selectedModelId: string | null; // null = latest
    setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
    isLoadingModels: boolean;
    setIsLoadingModels: React.Dispatch<React.SetStateAction<boolean>>;
    forceRefresh: boolean;
    triggerRefresh: (modelId: string | null) => void;
    clearRefresh: () => void;
};

// Default context value
const defaultSelectedModelContext: SelectedModelContextType = {
    availableModels: [],
    setAvailableModels: () => {},
    selectedModelId: null,
    setSelectedModelId: () => {},
    isLoadingModels: false,
    setIsLoadingModels: () => {},
    forceRefresh: false,
    triggerRefresh: () => {},
    clearRefresh: () => {},
};

export const SelectedModelContext = createContext<SelectedModelContextType>(defaultSelectedModelContext);

// Provider component
export function SelectedModelContextProvider({ children }: { children: React.ReactNode }) {
    const [availableModels, setAvailableModels] = useState<HBModelMetadata[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
    const [forceRefresh, setForceRefresh] = useState<boolean>(false);

    // Trigger a refresh: set the model ID and flag for force refresh
    const triggerRefresh = (modelId: string | null) => {
        setSelectedModelId(modelId);
        setForceRefresh(true);
    };

    // Clear the refresh flag after loading completes
    const clearRefresh = () => {
        setForceRefresh(false);
    };

    return (
        <SelectedModelContext.Provider
            value={{
                availableModels,
                setAvailableModels,
                selectedModelId,
                setSelectedModelId,
                isLoadingModels,
                setIsLoadingModels,
                forceRefresh,
                triggerRefresh,
                clearRefresh,
            }}
        >
            {children}
        </SelectedModelContext.Provider>
    );
}

// Hook for consuming the context
export function useSelectedModelContext() {
    const context = useContext(SelectedModelContext);
    return context;
}
