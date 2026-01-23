import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApertureType, ElementUValueResult, WindowUValueResponse } from '../types';
import { ApertureService } from '../ApertureView/services/apertureService';

const DEBOUNCE_MS = 300;

interface UseApertureUValueResult {
    uValueData: WindowUValueResponse | null;
    elementUValues: Map<number, ElementUValueResult>;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Generates a stable key from aperture properties that affect U-value calculation.
 * Only includes properties relevant to thermal performance, excluding display-only
 * properties like names which don't affect U-value.
 */
const generateUValueDependencyKey = (aperture: ApertureType | null): string => {
    if (!aperture) return 'null';

    // Extract only U-value-relevant properties from elements
    const elementKeys = aperture.elements.map(el => ({
        id: el.id,
        geometry: [el.column_number, el.row_number, el.col_span, el.row_span],
        frames: el.frames,
        glazing: el.glazing,
        operation: el.operation,
    }));

    return JSON.stringify({
        id: aperture.id,
        columnWidths: aperture.column_widths_mm,
        rowHeights: aperture.row_heights_mm,
        elements: elementKeys,
    });
};

/**
 * Custom hook for fetching the effective U-value of an aperture.
 *
 * The U-value is calculated per ISO 10077-1:2006 (uninstalled, excluding psi-install).
 * API calls are debounced by 300ms to reduce server load during rapid input changes.
 *
 * @param aperture - The aperture to fetch U-value for, or null. The hook will refetch
 *                   only when U-value-relevant properties change (dimensions, frames,
 *                   glazing, operation), not when display-only properties change (names).
 * @returns Object containing U-value data, loading state, error state, and refetch function
 */
export const useApertureUValue = (aperture: ApertureType | null): UseApertureUValueResult => {
    const apertureId = aperture?.id ?? null;

    // Generate a stable key that only changes when U-value-affecting properties change
    const uValueDependencyKey = useMemo(() => generateUValueDependencyKey(aperture), [aperture]);
    const [uValueData, setUValueData] = useState<WindowUValueResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Debounced refetch when U-value-relevant properties change
    useEffect(() => {
        // Show loading state immediately for responsive UI
        if (apertureId !== null) {
            setLoading(true);
        }

        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the actual API call
        debounceTimerRef.current = setTimeout(() => {
            fetchUValue();
        }, DEBOUNCE_MS);

        // Cleanup on unmount or when dependencies change
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [fetchUValue, uValueDependencyKey, apertureId]);

    // Build a Map from element_id to ElementUValueResult for efficient lookup
    const elementUValues = useMemo(() => {
        const map = new Map<number, ElementUValueResult>();
        if (uValueData?.element_u_values) {
            for (const ev of uValueData.element_u_values) {
                map.set(ev.element_id, ev);
            }
        }
        return map;
    }, [uValueData]);

    return {
        uValueData,
        elementUValues,
        loading,
        error,
        refetch: fetchUValue,
    };
};
