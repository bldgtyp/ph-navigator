import { useEffect, useState } from 'react';

import { MaterialType, UseLoadMaterialsReturn } from '../types/Material';
import { fetchAndCacheMaterials } from './MaterialsContext.Utility';

export const useLoadMaterials = (): UseLoadMaterialsReturn => {
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

    return { isLoadingMaterials, setIsLoadingMaterials, materials, setMaterials };
};
