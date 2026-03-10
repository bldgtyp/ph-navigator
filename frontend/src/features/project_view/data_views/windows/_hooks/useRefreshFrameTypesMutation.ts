import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';

interface RefreshResponseType {
    message: string;
    types_added: number;
    types_updated: number;
    types_total_count: number;
}

export function useRefreshFrameTypesMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => fetchGet<RefreshResponseType>('aperture/refresh-db-frame-types-from-air-table'),
        onSuccess: response => {
            queryClient.invalidateQueries({ queryKey: queryKeys.frameTypes() });
            alert(
                `Frame types refreshed successfully: ${response.types_added} added, ${response.types_updated} updated. Total frames: ${response.types_total_count}`
            );
        },
        onError: (error: Error) => {
            console.error('Error refreshing frame types:', error);
            alert('Error refreshing frame data. Please try again later.');
        },
    });
}
