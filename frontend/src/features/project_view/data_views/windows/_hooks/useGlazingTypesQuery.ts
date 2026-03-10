import { useQuery } from '@tanstack/react-query';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { ApertureGlazingType } from '../pages/UnitBuilder/types';

export function useGlazingTypesQuery() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.glazingTypes(),
        queryFn: () => fetchGet<ApertureGlazingType[]>('aperture/get-glazing-types'),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 24 * 60 * 60 * 1000,
    });

    return {
        glazingTypes: data ?? [],
        isLoadingGlazingTypes: isLoading,
        error,
    };
}
