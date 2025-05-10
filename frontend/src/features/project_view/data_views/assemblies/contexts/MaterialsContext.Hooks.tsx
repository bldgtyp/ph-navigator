import { useEffect, useState } from "react";

import { getWithAlert } from "../../../../../api/getWithAlert";
import { MaterialType, UseLoadMaterialsReturn } from "../types/Material";


/**
 * Custom hook to load materials data, with caching support using localStorage.
 * 
 * This hook fetches materials data from an API endpoint and caches the result in
 * localStorage for 24 hours. If cached data is available and not expired, it will
 * be used instead of making a new API request. The hook also manages a loading
 * state to indicate whether the data is being fetched.
 * 
 * @returns {Object} An object containing:
 * - `isLoading` (boolean): Indicates whether the materials data is currently being loaded.
 * - `materials` (any[]): The loaded materials data, or an empty array if no data is available.
 * 
 * @example
 * ```tsx
 * const { isLoading, materials } = useLoadMaterials();
 * 
 * if (isLoading) {
 *     return <div>Loading...</div>;
 * }
 * 
 * return (
 *     <ul>
 *         {materials.map((material, index) => (
 *             <li key={index}>{material.name}</li>
 *         ))}
 *     </ul>
 * );
 * ```
 */
export const useLoadMaterials = (): UseLoadMaterialsReturn => {
    const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(true);
    const [materials, setMaterials] = useState<MaterialType[]>([]);

    const cacheKey = 'materials';
    const cacheExpiryKey = 'materials_expiry';
    const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

    useEffect(() => {
        async function loadProjectData() {
            try {
                // ----------------------------------------------------------------------
                // Check if cached data exists and is not expired
                const cachedData = localStorage.getItem(cacheKey);
                const cachedExpiry = localStorage.getItem(cacheExpiryKey);

                if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                    setMaterials(JSON.parse(cachedData));
                    setIsLoadingMaterials(false);
                    return;
                }

                // ----------------------------------------------------------------------
                // If no valid cached data, fetch from API
                const d = await getWithAlert<MaterialType[]>('assembly/get_materials');
                setMaterials(d || []);

                // ----------------------------------------------------------------------
                // Cache the data and set expiry
                localStorage.setItem(cacheKey, JSON.stringify(d || []));
                localStorage.setItem(cacheExpiryKey, (Date.now() + cacheDuration).toString());
            } catch (error) {
                alert("Error loading Material Data. Please try again later.");
                console.error("Error loading Material Data:", error);
            } finally {
                setIsLoadingMaterials(false);
            }
        }

        loadProjectData();
    }, [cacheDuration]);

    return { isLoadingMaterials, materials };
};