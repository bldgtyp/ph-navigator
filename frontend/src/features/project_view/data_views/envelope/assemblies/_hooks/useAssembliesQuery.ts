import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchGet } from '../../../../../../api/fetchApi';
import { queryKeys } from '../../../../../../api/queryKeys';
import { AssemblyType } from '../../_types/Assembly';

export function useAssembliesQuery() {
    const { projectId } = useParams();

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.assemblies(projectId || ''),
        queryFn: () => fetchGet<AssemblyType[]>(`assembly/get-assemblies/${projectId}`),
        enabled: !!projectId,
    });

    return {
        assemblies: data ?? [],
        isLoadingAssemblies: isLoading,
        error,
    };
}
