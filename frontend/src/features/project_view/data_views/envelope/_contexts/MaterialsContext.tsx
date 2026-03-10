import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { MaterialType } from '../_types/Material';
import { useMaterialsQuery } from '../_hooks/useMaterialsQuery';

interface MaterialsContextType {
    isLoadingMaterials: boolean;
    setIsLoadingMaterials: React.Dispatch<React.SetStateAction<boolean>>;
    materials: MaterialType[];
    setMaterials: React.Dispatch<React.SetStateAction<MaterialType[]>>;
}

const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);

export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { materials: queryMaterials, isLoadingMaterials: queryLoading } = useMaterialsQuery();

    // Keep local state to preserve the existing interface (setMaterials, setIsLoadingMaterials)
    // used by Assembly.Context for refresh operations. Sync from query data.
    const [materials, setMaterials] = useState<MaterialType[]>([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(true);

    useEffect(() => {
        if (queryMaterials.length > 0) {
            setMaterials(queryMaterials);
        }
    }, [queryMaterials]);

    useEffect(() => {
        setIsLoadingMaterials(queryLoading);
    }, [queryLoading]);

    const value = useMemo(
        () => ({ isLoadingMaterials, setIsLoadingMaterials, materials, setMaterials }),
        [isLoadingMaterials, materials]
    );

    return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>;
};

export const useMaterials = (): MaterialsContextType => {
    const context = useContext(MaterialsContext);
    if (!context) {
        throw new Error('useMaterials must be used within a MaterialsProvider');
    }
    return context;
};
