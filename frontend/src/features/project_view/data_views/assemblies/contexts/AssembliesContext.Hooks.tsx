import { useEffect, useState } from "react";

import { getWithAlert } from "../../../../../api/getWithAlert";
import { AssemblyType, UseLoadAssembliesReturn } from "../types/Assembly";


export const useLoadAssemblies = (): UseLoadAssembliesReturn => {
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);

    useEffect(() => {
        async function loadProjectData() {
            try {
                // ----------------------------------------------------------------------
                // If no valid cached data, fetch from API
                const d = await getWithAlert<AssemblyType[]>('assembly/get_assemblies');
                setAssemblies(d || []);

            } catch (error) {
                alert("Error loading Assemblies Data. Please try again later.");
                console.error("Error loading Assemblies Data:", error);
            } finally {
                setIsLoadingAssemblies(false);
            }
        }

        loadProjectData();
    }, []);

    return { isLoadingAssemblies, assemblies };
};