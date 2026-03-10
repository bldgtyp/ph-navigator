import { createContext, useCallback, useContext, useMemo } from 'react';

import { ApertureGlazingType } from '../pages/UnitBuilder/types';
import { useGlazingTypesQuery } from '../_hooks/useGlazingTypesQuery';
import { useRefreshGlazingTypesMutation } from '../_hooks/useRefreshGlazingTypesMutation';

interface GlazingTypesContextType {
    isLoadingGlazingTypes: boolean;
    glazingTypes: ApertureGlazingType[];
    handleRefreshGlazingTypes: () => Promise<void>;
}

const GlazingTypesContext = createContext<GlazingTypesContextType | undefined>(undefined);

export const GlazingTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { glazingTypes, isLoadingGlazingTypes } = useGlazingTypesQuery();
    const refreshMutation = useRefreshGlazingTypesMutation();

    const handleRefreshGlazingTypes = useCallback(async () => {
        await refreshMutation.mutateAsync();
    }, [refreshMutation]);

    const isLoading = isLoadingGlazingTypes || refreshMutation.isPending;

    const value = useMemo(
        () => ({
            isLoadingGlazingTypes: isLoading,
            glazingTypes,
            handleRefreshGlazingTypes,
        }),
        [isLoading, glazingTypes, handleRefreshGlazingTypes]
    );

    return <GlazingTypesContext.Provider value={value}>{children}</GlazingTypesContext.Provider>;
};

export const useGlazingTypes = (): GlazingTypesContextType => {
    const context = useContext(GlazingTypesContext);
    if (!context) {
        throw new Error('useGlazingTypes must be used within a GlazingTypesProvider');
    }
    return context;
};
