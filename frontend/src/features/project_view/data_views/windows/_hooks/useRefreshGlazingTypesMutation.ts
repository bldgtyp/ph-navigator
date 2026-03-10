import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';

interface RefreshResponseType {
    message: string;
    types_added: number;
    types_updated: number;
    types_total_count: number;
}

export function useRefreshGlazingTypesMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => fetchGet<RefreshResponseType>('aperture/refresh-db-glazing-types-from-air-table'),
        onSuccess: response => {
            queryClient.invalidateQueries({ queryKey: queryKeys.glazingTypes() });
            alert(
                `Glazing types refreshed successfully: ${response.types_added} added, ${response.types_updated} updated. Total glazings: ${response.types_total_count}`
            );
        },
        onError: (error: Error) => {
            console.error('Error refreshing glazing types:', error);
            alert('Error refreshing glazing data. Please try again later.');
        },
    });
}
