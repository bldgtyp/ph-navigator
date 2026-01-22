import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { MaterialType } from '../_types/Material';
import { fetchAndCacheMaterials } from './MaterialsContext.Utility';

interface MaterialsContextType {
    isLoadingMaterials: boolean;
    setIsLoadingMaterials: React.Dispatch<React.SetStateAction<boolean>>;
    materials: MaterialType[];
    setMaterials: React.Dispatch<React.SetStateAction<MaterialType[]>>;
}

const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);

export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(true);
    const [materials, setMaterials] = useState<MaterialType[]>([]);

    useEffect(() => {
        async function loadProjectData() {
            try {
                // Check if cached data exists and is not expired
                const cachedData = localStorage.getItem('materials');
                const cachedExpiry = localStorage.getItem('materials_expiry');

                if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                    setMaterials(JSON.parse(cachedData));
                } else {
                    // Fetch and cache materials if no valid cache exists
                    const fetchedMaterials = await fetchAndCacheMaterials();
                    setMaterials(fetchedMaterials);
                }
            } catch (error) {
                alert('Error loading Material Data. Please try again later.');
                console.error('Error loading Material Data:', error);
            } finally {
                setIsLoadingMaterials(false);
            }
        }

        loadProjectData();
    }, []);

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
