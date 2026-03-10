import { useQuery } from '@tanstack/react-query';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { ApertureFrameType } from '../pages/UnitBuilder/types';

export function useFrameTypesQuery() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.frameTypes(),
        queryFn: () => fetchGet<ApertureFrameType[]>('aperture/get-frame-types'),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 24 * 60 * 60 * 1000,
    });

    return {
        frameTypes: data ?? [],
        isLoadingFrameTypes: isLoading,
        error,
    };
}
