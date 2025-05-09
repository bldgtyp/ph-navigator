import { useEffect, useState } from "react";

import { fetchWithAlert } from "../../../../../api/fetchData";
import { Assembly, UseLoadAssembliesReturn } from "../types/Assembly";


/**
 * Custom hook to load Assemblies data, with caching support using localStorage.
 * 
 * This hook fetches Assemblies data from an API endpoint and caches the result in
 * localStorage for 24 hours. If cached data is available and not expired, it will
 * be used instead of making a new API request. The hook also manages a loading
 * state to indicate whether the data is being fetched.
 * 
 * @returns {Object} An object containing:
 * - `isLoading` (boolean): Indicates whether the Assembliess data is currently being loaded.
 * - `Assemblies` (any[]): The loaded Assemblies data, or an empty array if no data is available.
 * 
 * @example
 * ```tsx
 * const { isLoading, Assemblies } = useLoadAssembliess();
 * 
 * if (isLoading) {
 *     return <div>Loading...</div>;
 * }
 * 
 * return (
 *     <ul>
 *         {Assemblies.map((Assemblies, index) => (
 *             <li key={index}>{Assemblies.name}</li>
 *         ))}
 *     </ul>
 * );
 * ```
 */
export const useLoadAssemblies = (): UseLoadAssembliesReturn => {
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<Assembly[]>([]);

    const cacheKey = 'Assemblies';
    const cacheExpiryKey = 'Assemblies_expiry';
    const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

    useEffect(() => {
        async function loadProjectData() {
            try {
                // ----------------------------------------------------------------------
                // Check if cached data exists and is not expired
                const cachedData = localStorage.getItem(cacheKey);
                const cachedExpiry = localStorage.getItem(cacheExpiryKey);

                if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                    setAssemblies(JSON.parse(cachedData));
                    setIsLoadingAssemblies(false);
                    return;
                }

                // ----------------------------------------------------------------------
                // If no valid cached data, fetch from API
                const d = await fetchWithAlert<Assembly[]>('assembly/get_assemblies');
                setAssemblies(d || []);

                // ----------------------------------------------------------------------
                // Cache the data and set expiry
                localStorage.setItem(cacheKey, JSON.stringify(d || []));
                localStorage.setItem(cacheExpiryKey, (Date.now() + cacheDuration).toString());
            } catch (error) {
                alert("Error loading Assemblies Data. Please try again later.");
                console.error("Error loading Assemblies Data:", error);
            } finally {
                setIsLoadingAssemblies(false);
            }
        }

        loadProjectData();
    }, [cacheDuration]);

    return { isLoadingAssemblies, assemblies };
};