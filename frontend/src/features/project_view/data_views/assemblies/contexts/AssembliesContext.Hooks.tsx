import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getWithAlert } from "../../../../../api/getWithAlert";
import { AssemblyType, UseLoadAssembliesReturn } from "../types/Assembly";


export const useLoadAssemblies = (): UseLoadAssembliesReturn => {
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);
    const { projectId } = useParams();

    useEffect(() => {
        async function loadProjectData(projectId: string | undefined) {
            try {
                // ----------------------------------------------------------------------
                // If no valid cached data, fetch from API
                const d = await getWithAlert<AssemblyType[]>(`assembly/get_assemblies/${projectId}`);
                setAssemblies(d || []);

            } catch (error) {
                alert("Error loading Assemblies Data. Please try again later.");
                console.error("Error loading Assemblies Data:", error);
            } finally {
                setIsLoadingAssemblies(false);
            }
        }

        loadProjectData(projectId);
    }, [projectId]);

    return { isLoadingAssemblies, assemblies };
};