import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { ManufacturerFilterConfig } from '../pages/UnitBuilder/types';

export function useManufacturerFilterQuery() {
    const { projectId } = useParams<{ projectId: string }>();

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.manufacturerFilters(projectId || ''),
        queryFn: () => fetchGet<ManufacturerFilterConfig>(`aperture/manufacturer-filters/${projectId}`),
        enabled: !!projectId,
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
    });

    return {
        filterConfig: data ?? null,
        enabledFrameManufacturers: data?.enabled_frame_manufacturers ?? [],
        enabledGlazingManufacturers: data?.enabled_glazing_manufacturers ?? [],
        isLoading,
        error,
    };
}
