import { useQuery } from '@tanstack/react-query';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { MaterialType } from '../_types/Material';

export function useMaterialsQuery() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.materials(),
        queryFn: () => fetchGet<MaterialType[]>('assembly/load-all-materials-from-airtable'),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
        materials: data ?? [],
        isLoadingMaterials: isLoading,
        error,
    };
}
