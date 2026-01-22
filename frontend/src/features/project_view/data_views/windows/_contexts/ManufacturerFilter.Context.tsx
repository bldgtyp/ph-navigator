import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ManufacturerFilterConfig } from '../pages/UnitBuilder/types';
import { ManufacturerFilterService } from '../pages/UnitBuilder/ElementsTable/services/manufacturerFilterService';

interface ManufacturerFilterContextType {
    filterConfig: ManufacturerFilterConfig | null;
    enabledFrameManufacturers: string[];
    enabledGlazingManufacturers: string[];
    isLoading: boolean;
    updateFilters: (frameMfrs: string[], glazingMfrs: string[]) => Promise<void>;
    refreshFilters: () => Promise<void>;
}

const ManufacturerFilterContext = createContext<ManufacturerFilterContextType | undefined>(undefined);

export const ManufacturerFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Window routes use :projectId, which maps to the API's bt_number parameter.
    const { projectId } = useParams<{ projectId: string }>();
    const [filterConfig, setFilterConfig] = useState<ManufacturerFilterConfig | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadFilters = useCallback(async () => {
        if (!projectId) return;

        try {
            setIsLoading(true);
            const config = await ManufacturerFilterService.loadFilters(projectId);
            setFilterConfig(config);
        } catch (error) {
            console.error('Error loading manufacturer filters:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadFilters();
    }, [loadFilters]);

    const updateFilters = useCallback(
        async (frameMfrs: string[], glazingMfrs: string[]) => {
            if (!projectId) return;

            try {
                setIsLoading(true);
                const updatedConfig = await ManufacturerFilterService.updateFilters(projectId, frameMfrs, glazingMfrs);
                setFilterConfig(updatedConfig);
            } catch (error) {
                console.error('Error updating manufacturer filters:', error);
                alert('Error updating filters. Please try again.');
            } finally {
                setIsLoading(false);
            }
        },
        [projectId]
    );

    const refreshFilters = useCallback(async () => {
        if (!projectId) return;
        ManufacturerFilterService.clearCache(projectId);
        await loadFilters();
    }, [projectId, loadFilters]);

    const value = useMemo(
        () => ({
            filterConfig,
            enabledFrameManufacturers: filterConfig?.enabled_frame_manufacturers ?? [],
            enabledGlazingManufacturers: filterConfig?.enabled_glazing_manufacturers ?? [],
            isLoading,
            updateFilters,
            refreshFilters,
        }),
        [filterConfig, isLoading, updateFilters, refreshFilters]
    );

    return <ManufacturerFilterContext.Provider value={value}>{children}</ManufacturerFilterContext.Provider>;
};

export const useManufacturerFilters = (): ManufacturerFilterContextType => {
    const context = useContext(ManufacturerFilterContext);
    if (!context) {
        throw new Error('useManufacturerFilters must be used within a ManufacturerFilterProvider');
    }
    return context;
};
