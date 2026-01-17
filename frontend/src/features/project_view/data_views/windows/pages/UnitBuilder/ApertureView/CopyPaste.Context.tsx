import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApertureElementType, ElementAssignmentsPayload } from '../types';
import { useApertures } from '../../../_contexts/Aperture.Context';

const buildAssignmentsPayload = (element: ApertureElementType): ElementAssignmentsPayload => ({
    operation: element.operation ?? null,
    glazingTypeId: element.glazing.glazing_type.id,
    frameTypeIds: {
        top: element.frames.top.frame_type.id,
        right: element.frames.right.frame_type.id,
        bottom: element.frames.bottom.frame_type.id,
        left: element.frames.left.frame_type.id,
    },
});

interface CopyPasteContextType {
    isPickMode: boolean;
    isPasteMode: boolean;
    copyPayload: ElementAssignmentsPayload | null;
    lastPastedElementId: number | null;
    startPickMode: () => void;
    startPasteMode: (element: ApertureElementType) => void;
    resetPasteMode: () => void;
    pasteToElement: (elementId: number) => Promise<void>;
}

const CopyPasteContext = createContext<CopyPasteContextType | undefined>(undefined);

export const CopyPasteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { apertures, handleUpdateApertureElementAssignments } = useApertures();
    const [copyPayload, setCopyPayload] = useState<ElementAssignmentsPayload | null>(null);
    const [isPickMode, setIsPickMode] = useState(false);
    const [sourceElementId, setSourceElementId] = useState<number | null>(null);
    const [lastPastedElementId, setLastPastedElementId] = useState<number | null>(null);
    const pulseTimeoutRef = useRef<number | null>(null);

    const isPasteMode = Boolean(copyPayload);

    const resetPasteMode = useCallback(() => {
        setCopyPayload(null);
        setIsPickMode(false);
        setSourceElementId(null);
        setLastPastedElementId(null);
    }, []);

    const startPickMode = useCallback(() => {
        setIsPickMode(true);
        setCopyPayload(null);
        setSourceElementId(null);
        setLastPastedElementId(null);
    }, []);

    const clearPulseTimeout = useCallback(() => {
        if (pulseTimeoutRef.current) {
            window.clearTimeout(pulseTimeoutRef.current);
            pulseTimeoutRef.current = null;
        }
    }, []);

    const startPasteMode = useCallback((element: ApertureElementType) => {
        setCopyPayload(buildAssignmentsPayload(element));
        setIsPickMode(false);
        setSourceElementId(element.id);
        setLastPastedElementId(null);
    }, []);

    const pasteToElement = useCallback(
        async (elementId: number) => {
            if (!copyPayload) {
                return;
            }

            try {
                await handleUpdateApertureElementAssignments(elementId, copyPayload);
                setLastPastedElementId(elementId);

                clearPulseTimeout();
                pulseTimeoutRef.current = window.setTimeout(() => {
                    setLastPastedElementId(null);
                }, 600);
            } catch (error) {
                console.error('Failed to paste assignments:', error);
                alert('Failed to paste assignments. Please try again.');
            }
        },
        [clearPulseTimeout, copyPayload, handleUpdateApertureElementAssignments]
    );

    useEffect(() => {
        if (!isPickMode && !isPasteMode) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                resetPasteMode();
            }
        };

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target || target.closest('.aperture-element')) {
                return;
            }
            resetPasteMode();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handlePointerDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handlePointerDown, true);
        };
    }, [isPasteMode, isPickMode, resetPasteMode]);

    useEffect(() => {
        if (!isPasteMode || !sourceElementId) {
            return;
        }

        const sourceExists = apertures.some(aperture =>
            aperture.elements.some(element => element.id === sourceElementId)
        );

        if (!sourceExists) {
            resetPasteMode();
            alert('Copied element no longer exists. Paste mode has been cleared.');
        }
    }, [apertures, isPasteMode, resetPasteMode, sourceElementId]);

    useEffect(() => {
        return () => {
            clearPulseTimeout();
        };
    }, [clearPulseTimeout]);

    const value = useMemo<CopyPasteContextType>(
        () => ({
            isPickMode,
            isPasteMode,
            copyPayload,
            lastPastedElementId,
            startPickMode,
            startPasteMode,
            resetPasteMode,
            pasteToElement,
        }),
        [
            copyPayload,
            isPasteMode,
            isPickMode,
            lastPastedElementId,
            pasteToElement,
            resetPasteMode,
            startPasteMode,
            startPickMode,
        ]
    );

    return <CopyPasteContext.Provider value={value}>{children}</CopyPasteContext.Provider>;
};

export const useCopyPaste = (): CopyPasteContextType => {
    const context = useContext(CopyPasteContext);
    if (!context) {
        throw new Error('useCopyPaste must be used within a CopyPasteProvider');
    }
    return context;
};
