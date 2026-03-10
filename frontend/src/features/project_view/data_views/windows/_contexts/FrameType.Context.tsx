import { createContext, useCallback, useContext, useMemo } from 'react';

import { ApertureFrameType } from '../pages/UnitBuilder/types';
import { useFrameTypesQuery } from '../_hooks/useFrameTypesQuery';
import { useRefreshFrameTypesMutation } from '../_hooks/useRefreshFrameTypesMutation';

interface FrameTypesContextType {
    isLoadingFrameTypes: boolean;
    frameTypes: ApertureFrameType[];
    handleRefreshFrameTypes: () => Promise<void>;
}

const FrameTypesContext = createContext<FrameTypesContextType | undefined>(undefined);

export const FrameTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { frameTypes, isLoadingFrameTypes } = useFrameTypesQuery();
    const refreshMutation = useRefreshFrameTypesMutation();

    const handleRefreshFrameTypes = useCallback(async () => {
        await refreshMutation.mutateAsync();
    }, [refreshMutation]);

    const isLoading = isLoadingFrameTypes || refreshMutation.isPending;

    const value = useMemo(
        () => ({
            isLoadingFrameTypes: isLoading,
            frameTypes,
            handleRefreshFrameTypes,
        }),
        [isLoading, frameTypes, handleRefreshFrameTypes]
    );

    return <FrameTypesContext.Provider value={value}>{children}</FrameTypesContext.Provider>;
};

export const useFrameTypes = (): FrameTypesContextType => {
    const context = useContext(FrameTypesContext);
    if (!context) {
        throw new Error('useFrameTypes must be used within a FrameTypesProvider');
    }
    return context;
};
