import { useCallback, useEffect, useState } from 'react';

import { ApertureType, WindowUValueResponse } from '../types';
import { ApertureService } from '../ApertureView/services/apertureService';

interface UseApertureUValueResult {
    uValueData: WindowUValueResponse | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching the effective U-value of an aperture.
 *
 * The U-value is calculated per ISO 10077-1:2006 (uninstalled, excluding psi-install).
 *
 * @param aperture - The aperture to fetch U-value for, or null. The hook will refetch
 *                   whenever any aperture property changes (dimensions, frames, glazing, etc.)
 * @returns Object containing U-value data, loading state, error state, and refetch function
 */
export const useApertureUValue = (aperture: ApertureType | null): UseApertureUValueResult => {
    const apertureId = aperture?.id ?? null;
    const [uValueData, setUValueData] = useState<WindowUValueResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUValue = useCallback(async () => {
        if (apertureId === null) {
            setUValueData(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await ApertureService.fetchUValue(apertureId);
            setUValueData(response);

            if (!response.is_valid && response.warnings.length > 0) {
                setError(response.warnings.join('; '));
            }
        } catch (err) {
            console.error('Error fetching U-value:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch U-value');
            setUValueData(null);
        } finally {
            setLoading(false);
        }
    }, [apertureId]);

    // Refetch when aperture changes (including dimension/element changes)
    useEffect(() => {
        fetchUValue();
    }, [fetchUValue, aperture]);

    return {
        uValueData,
        loading,
        error,
        refetch: fetchUValue,
    };
};
