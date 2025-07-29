import { createContext, useContext, useState } from 'react';

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
    initialScale = 1.0,
    minScale = 0.1,
    maxScale = 5.0,
    zoomStep = 0.2,
}) => {
    const [scaleFactor, setScaleFactor] = useState<number>(initialScale);

    const zoomIn = () => {
        setScaleFactor(prev => Math.min(prev + zoomStep, maxScale));
    };

    const zoomOut = () => {
        setScaleFactor(prev => Math.max(prev - zoomStep, minScale));
    };

    const resetZoom = () => {
        setScaleFactor(initialScale);
    };

    const getScaleLabel = () => {
        const percentage = Math.round(scaleFactor * 100);
        return `${percentage}%`;
    };

    return (
        <ZoomContext.Provider
            value={{
                scaleFactor,
                setScaleFactor,
                zoomIn,
                zoomOut,
                resetZoom,
                getScaleLabel,
            }}
        >
            {children}
        </ZoomContext.Provider>
    );
};

export const useZoom = (): ZoomContextType => {
    const context = useContext(ZoomContext);
    if (!context) {
        throw new Error('useZoom must be used within a ZoomProvider');
    }
    return context;
};
