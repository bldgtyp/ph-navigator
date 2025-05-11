import { getWithAlert } from "../../../../../api/getWithAlert";
import { MaterialType } from "../types/Material";

const cacheKey = 'materials';
const cacheExpiryKey = 'materials_expiry';
const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

export const fetchAndCacheMaterials = async (): Promise<MaterialType[]> => {
    try {
        // Fetch materials from the database
        const materials = await getWithAlert<MaterialType[]>('assembly/get_materials');

        // Cache the data to local-storage and set expiry
        localStorage.setItem(cacheKey, JSON.stringify(materials || []));
        localStorage.setItem(cacheExpiryKey, (Date.now() + cacheDuration).toString());

        return materials || [];
    } catch (error) {
        console.error("Error fetching materials:", error);
        throw error;
    }
};