import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { ApertureType } from '../pages/UnitBuilder/types';

export function useAperturesQuery() {
    const { projectId } = useParams();

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.apertures(projectId || ''),
        queryFn: () => fetchGet<ApertureType[]>(`aperture/get-apertures/${projectId}`),
        enabled: !!projectId,
    });

    return {
        apertures: data ?? [],
        isLoadingApertures: isLoading,
        error,
    };
}
