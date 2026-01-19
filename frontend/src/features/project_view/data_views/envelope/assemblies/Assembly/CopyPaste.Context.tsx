import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { patchWithAlert } from '../../../../../../api/patchWithAlert';

import { SegmentType, SpecificationStatus } from '../../_types/Segment';
import { useAssemblyContext } from './Assembly.Context';

// The payload captured when copying a segment's material properties (not width)
export interface SegmentMaterialPayload {
    material_id: string;
    steel_stud_spacing_mm: number | null;
    is_continuous_insulation: boolean;
    specification_status: SpecificationStatus;
    notes: string | null;
}

// A single undo entry for paste operations
interface UndoEntry {
    segmentId: number;
    previousMaterial: SegmentMaterialPayload;
    newMaterial: SegmentMaterialPayload;
    timestamp: number;
    assemblyId: number;
}

interface CopyPasteContextType {
    isPickMode: boolean;
    isPasteMode: boolean;
    copyPayload: SegmentMaterialPayload | null;
    sourceSegmentId: number | null;
    lastPastedSegmentId: number | null;
    undoStack: UndoEntry[];
    startPickMode: () => void;
    startPasteMode: (segment: SegmentType) => void;
    resetPasteMode: () => void;
    pasteToSegment: (targetSegment: SegmentType) => Promise<SegmentType | null>;
    undoLastPaste: () => Promise<void>;
}

const CopyPasteContext = createContext<CopyPasteContextType | undefined>(undefined);

const MAX_UNDO_STACK_SIZE = 20;

export const CopyPasteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { selectedAssemblyId, handleAssemblyChange } = useAssemblyContext();

    const [copyPayload, setCopyPayload] = useState<SegmentMaterialPayload | null>(null);
    const [isPickMode, setIsPickMode] = useState(false);
    const [sourceSegmentId, setSourceSegmentId] = useState<number | null>(null);
    const [lastPastedSegmentId, setLastPastedSegmentId] = useState<number | null>(null);
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
    const pulseTimeoutRef = useRef<number | null>(null);

    const isPasteMode = Boolean(copyPayload);

    // Clear paste mode when assembly changes
    useEffect(() => {
        setCopyPayload(null);
        setIsPickMode(false);
        setSourceSegmentId(null);
        setLastPastedSegmentId(null);
        setUndoStack([]);
    }, [selectedAssemblyId]);

    const clearPulseTimeout = useCallback(() => {
        if (pulseTimeoutRef.current !== null) {
            window.clearTimeout(pulseTimeoutRef.current);
            pulseTimeoutRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearPulseTimeout();
        };
    }, [clearPulseTimeout]);

    const startPickMode = useCallback(() => {
        setIsPickMode(true);
        setCopyPayload(null);
        setSourceSegmentId(null);
    }, []);

    const startPasteMode = useCallback((segment: SegmentType) => {
        const payload: SegmentMaterialPayload = {
            material_id: segment.material_id,
            steel_stud_spacing_mm: segment.steel_stud_spacing_mm,
            is_continuous_insulation: segment.is_continuous_insulation,
            specification_status: segment.specification_status,
            notes: segment.notes,
        };
        setCopyPayload(payload);
        setSourceSegmentId(segment.id);
        setIsPickMode(false);
    }, []);

    const resetPasteMode = useCallback(() => {
        setCopyPayload(null);
        setIsPickMode(false);
        setSourceSegmentId(null);
        setLastPastedSegmentId(null);
        clearPulseTimeout();
    }, [clearPulseTimeout]);

    const pasteToSegment = useCallback(
        async (targetSegment: SegmentType): Promise<SegmentType | null> => {
            if (!copyPayload || !selectedAssemblyId) return null;

            // Capture the previous state for undo
            const previousMaterial: SegmentMaterialPayload = {
                material_id: targetSegment.material_id,
                steel_stud_spacing_mm: targetSegment.steel_stud_spacing_mm,
                is_continuous_insulation: targetSegment.is_continuous_insulation,
                specification_status: targetSegment.specification_status,
                notes: targetSegment.notes,
            };

            try {
                let updatedSegment: SegmentType | null = null;

                // Update material_id
                if (copyPayload.material_id !== targetSegment.material_id) {
                    const response = await patchWithAlert<SegmentType>(
                        `assembly/update-segment-material/${targetSegment.id}`,
                        null,
                        { material_id: copyPayload.material_id }
                    );
                    if (response) updatedSegment = response;
                }

                // Update steel_stud_spacing_mm
                if (copyPayload.steel_stud_spacing_mm !== targetSegment.steel_stud_spacing_mm) {
                    const response = await patchWithAlert<SegmentType>(
                        `assembly/update-segment-steel-stud-spacing/${targetSegment.id}`,
                        null,
                        { steel_stud_spacing_mm: copyPayload.steel_stud_spacing_mm }
                    );
                    if (response) updatedSegment = response;
                }

                // Update is_continuous_insulation
                if (copyPayload.is_continuous_insulation !== targetSegment.is_continuous_insulation) {
                    const response = await patchWithAlert<SegmentType>(
                        `assembly/update-segment-is-continuous-insulation/${targetSegment.id}`,
                        null,
                        { is_continuous_insulation: copyPayload.is_continuous_insulation }
                    );
                    if (response) updatedSegment = response;
                }

                // Update specification_status
                if (copyPayload.specification_status !== targetSegment.specification_status) {
                    const response = await patchWithAlert<SegmentType>(
                        `assembly/update-segment-specification-status/${targetSegment.id}`,
                        null,
                        { specification_status: copyPayload.specification_status }
                    );
                    if (response) updatedSegment = response;
                }

                // Update notes
                if (copyPayload.notes !== targetSegment.notes) {
                    const response = await patchWithAlert<SegmentType>(
                        `assembly/update-segment-notes/${targetSegment.id}`,
                        null,
                        { notes: copyPayload.notes }
                    );
                    if (response) updatedSegment = response;
                }

                // Push to undo stack
                const undoEntry: UndoEntry = {
                    segmentId: targetSegment.id,
                    previousMaterial,
                    newMaterial: copyPayload,
                    timestamp: Date.now(),
                    assemblyId: selectedAssemblyId,
                };

                setUndoStack(prev => {
                    const newStack = [undoEntry, ...prev];
                    return newStack.slice(0, MAX_UNDO_STACK_SIZE);
                });

                // Trigger pulse animation
                setLastPastedSegmentId(targetSegment.id);
                clearPulseTimeout();
                pulseTimeoutRef.current = window.setTimeout(() => {
                    setLastPastedSegmentId(null);
                }, 600);

                // Refresh assembly to show updates
                if (selectedAssemblyId) {
                    handleAssemblyChange(selectedAssemblyId);
                }

                return updatedSegment;
            } catch (error) {
                console.error('Failed to paste segment material:', error);
                alert('Failed to paste material. Please try again.');
                return null;
            }
        },
        [copyPayload, selectedAssemblyId, clearPulseTimeout, handleAssemblyChange]
    );

    const undoLastPaste = useCallback(async () => {
        if (undoStack.length === 0 || !selectedAssemblyId) return;

        const [lastEntry, ...remainingStack] = undoStack;

        // Verify undo is for the current assembly
        if (lastEntry.assemblyId !== selectedAssemblyId) {
            alert('Cannot undo: The paste operation was for a different assembly.');
            return;
        }

        try {
            const prev = lastEntry.previousMaterial;
            const segmentId = lastEntry.segmentId;

            // Restore material_id
            await patchWithAlert<SegmentType>(`assembly/update-segment-material/${segmentId}`, null, {
                material_id: prev.material_id,
            });

            // Restore steel_stud_spacing_mm
            await patchWithAlert<SegmentType>(`assembly/update-segment-steel-stud-spacing/${segmentId}`, null, {
                steel_stud_spacing_mm: prev.steel_stud_spacing_mm,
            });

            // Restore is_continuous_insulation
            await patchWithAlert<SegmentType>(`assembly/update-segment-is-continuous-insulation/${segmentId}`, null, {
                is_continuous_insulation: prev.is_continuous_insulation,
            });

            // Restore specification_status
            await patchWithAlert<SegmentType>(`assembly/update-segment-specification-status/${segmentId}`, null, {
                specification_status: prev.specification_status,
            });

            // Restore notes
            await patchWithAlert<SegmentType>(`assembly/update-segment-notes/${segmentId}`, null, {
                notes: prev.notes,
            });

            setUndoStack(remainingStack);

            // Refresh assembly to show restored state
            handleAssemblyChange(selectedAssemblyId);
        } catch (error) {
            console.error('Failed to undo paste:', error);
            alert('Failed to undo. Please try again.');
        }
    }, [undoStack, selectedAssemblyId, handleAssemblyChange]);

    return (
        <CopyPasteContext.Provider
            value={{
                isPickMode,
                isPasteMode,
                copyPayload,
                sourceSegmentId,
                lastPastedSegmentId,
                undoStack,
                startPickMode,
                startPasteMode,
                resetPasteMode,
                pasteToSegment,
                undoLastPaste,
            }}
        >
            {children}
        </CopyPasteContext.Provider>
    );
};

export const useCopyPaste = (): CopyPasteContextType => {
    const context = useContext(CopyPasteContext);
    if (!context) {
        throw new Error('useCopyPaste must be used within a CopyPasteProvider');
    }
    return context;
};
