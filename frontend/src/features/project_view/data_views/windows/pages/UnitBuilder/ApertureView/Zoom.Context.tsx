import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface ZoomContextType {
    scaleFactor: number;
    setScaleFactor: React.Dispatch<React.SetStateAction<number>>;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    getScaleLabel: () => string;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

interface ZoomProviderProps {
    children: React.ReactNode;
    initialScale?: number;
    minScale?: number;
    maxScale?: number;
    zoomStep?: number;
}

export const ZoomProvider: React.FC<ZoomProviderProps> = ({
    children,
    initialScale = 0.1,
    minScale = 0.05,
    maxScale = 1.0,
    zoomStep = 0.05,
}) => {
    const [scaleFactor, setScaleFactor] = useState<number>(initialScale);

    const zoomIn = useCallback(() => {
        setScaleFactor(prev => Math.min(prev + zoomStep, maxScale));
    }, [zoomStep, maxScale]);

    const zoomOut = useCallback(() => {
        setScaleFactor(prev => Math.max(prev - zoomStep, minScale));
    }, [zoomStep, minScale]);

    const resetZoom = useCallback(() => {
        setScaleFactor(initialScale);
    }, [initialScale]);

    const getScaleLabel = useCallback(() => {
        const percentage = Math.round(scaleFactor * 100);
        return `${percentage}%`;
    }, [scaleFactor]);

    const value = useMemo(
        () => ({
            scaleFactor,
            setScaleFactor,
            zoomIn,
            zoomOut,
            resetZoom,
            getScaleLabel,
        }),
        [scaleFactor, zoomIn, zoomOut, resetZoom, getScaleLabel]
    );

    return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
};

export const useZoom = (): ZoomContextType => {
    const context = useContext(ZoomContext);
    if (!context) {
        throw new Error('useZoom must be used within a ZoomProvider');
    }
    return context;
};
