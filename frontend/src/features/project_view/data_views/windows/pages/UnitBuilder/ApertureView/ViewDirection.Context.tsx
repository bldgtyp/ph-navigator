import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ViewDirection = 'outside' | 'inside';

interface ViewDirectionContextType {
    viewDirection: ViewDirection;
    isInsideView: boolean;
    toggleViewDirection: () => void;
    setViewDirection: (direction: ViewDirection) => void;
}

const STORAGE_KEY = 'window_view_direction';

const ViewDirectionContext = createContext<ViewDirectionContextType | undefined>(undefined);

export const ViewDirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [viewDirection, setViewDirectionState] = useState<ViewDirection>(() => {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        return stored === 'inside' ? 'inside' : 'outside';
    });

    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, viewDirection);
    }, [viewDirection]);

    const value = useMemo<ViewDirectionContextType>(
        () => ({
            viewDirection,
            isInsideView: viewDirection === 'inside',
            toggleViewDirection: () => setViewDirectionState(prev => (prev === 'inside' ? 'outside' : 'inside')),
            setViewDirection: setViewDirectionState,
        }),
        [viewDirection]
    );

    return <ViewDirectionContext.Provider value={value}>{children}</ViewDirectionContext.Provider>;
};

export const useViewDirection = (): ViewDirectionContextType => {
    const context = useContext(ViewDirectionContext);
    if (!context) {
        throw new Error('useViewDirection must be used within a ViewDirectionProvider');
    }
    return context;
};
