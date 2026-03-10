import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { ManufacturerFilterConfig } from '../pages/UnitBuilder/types';
import { queryKeys } from '../../../../../api/queryKeys';
import { useManufacturerFilterQuery } from '../_hooks/useManufacturerFilterQuery';
import { useUpdateManufacturerFilterMutation } from '../_hooks/useUpdateManufacturerFilterMutation';

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
    const { projectId } = useParams<{ projectId: string }>();
    const queryClient = useQueryClient();
    const {
        filterConfig,
        enabledFrameManufacturers,
        enabledGlazingManufacturers,
        isLoading: queryLoading,
    } = useManufacturerFilterQuery();
    const updateMutation = useUpdateManufacturerFilterMutation();

    const updateFilters = useCallback(
        async (frameMfrs: string[], glazingMfrs: string[]) => {
            await updateMutation.mutateAsync({ frameMfrs, glazingMfrs });
        },
        [updateMutation]
    );

    const refreshFilters = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.manufacturerFilters(projectId || '') });
    }, [queryClient, projectId]);

    const isLoading = queryLoading || updateMutation.isPending;

    const value = useMemo(
        () => ({
            filterConfig,
            enabledFrameManufacturers,
            enabledGlazingManufacturers,
            isLoading,
            updateFilters,
            refreshFilters,
        }),
        [filterConfig, enabledFrameManufacturers, enabledGlazingManufacturers, isLoading, updateFilters, refreshFilters]
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
