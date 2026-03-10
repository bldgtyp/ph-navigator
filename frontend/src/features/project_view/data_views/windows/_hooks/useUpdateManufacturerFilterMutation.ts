import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchPatch } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { ManufacturerFilterConfig } from '../pages/UnitBuilder/types';

export function useUpdateManufacturerFilterMutation() {
    const { projectId } = useParams<{ projectId: string }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ frameMfrs, glazingMfrs }: { frameMfrs: string[]; glazingMfrs: string[] }) =>
            fetchPatch<ManufacturerFilterConfig>(`aperture/manufacturer-filters/${projectId}`, {
                enabled_frame_manufacturers: frameMfrs,
                enabled_glazing_manufacturers: glazingMfrs,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.manufacturerFilters(projectId || '') });
        },
        onError: (error: Error) => {
            console.error('Error updating manufacturer filters:', error);
            alert('Error updating filters. Please try again.');
        },
    });
}
