import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import {
    ApertureElementType,
    ApertureType,
    ElementAssignmentsPayload,
    ElementOperation,
    InsertPosition,
} from '../pages/UnitBuilder/types';
import { FramePosition } from '../pages/UnitBuilder/ElementsTable/types';
import { ApertureService } from '../pages/UnitBuilder/ApertureView/services/apertureService';
import { queryKeys } from '../../../../../api/queryKeys';
import { useAperturesQuery } from '../_hooks/useAperturesQuery';

function getApertureElementById(aperture: ApertureType, elementId: number): ApertureElementType | undefined {
    return aperture.elements.find(element => element.id === elementId);
}

function areElementsAdjacent(element: ApertureElementType, other: ApertureElementType): boolean {
    const horizontallyAdjacent =
        element.row_number === other.row_number &&
        (Math.abs(element.column_number - other.column_number) === 1 ||
            element.column_number + element.col_span === other.column_number ||
            other.column_number + other.col_span === element.column_number);

    const verticallyAdjacent =
        element.column_number === other.column_number &&
        (Math.abs(element.row_number - other.row_number) === 1 ||
            element.row_number + element.row_span === other.row_number ||
            other.row_number + other.row_span === element.row_number);

    return horizontallyAdjacent || verticallyAdjacent;
}

interface AperturesContextType {
    isLoadingApertures: boolean;
    apertures: ApertureType[];
    selectedApertureId: number | null;
    activeAperture: ApertureType | null;
    setSelectedApertureId: React.Dispatch<React.SetStateAction<number | null>>;
    handleSetActiveApertureById: (id: any) => void;
    handleSetActiveAperture: (aperture: ApertureType) => void;
    handleNameChange: (id: any, newName: string) => void;
    handleAddAperture: () => void;
    handleDeleteAperture: (id: any) => void;
    handleDuplicateAperture: (id: any) => void;
    handleUpdateAperture: (aperture: ApertureType) => void;
    handleAddRow: (position?: InsertPosition) => void;
    handleDeleteRow: (index: number) => void;
    handleAddColumn: (position?: InsertPosition) => void;
    handleDeleteColumn: (index: number) => void;
    handleAddRowAtEdge: (edge: 'top' | 'bottom') => void;
    handleAddColumnAtEdge: (edge: 'left' | 'right') => void;
    getCellSize: (row: number, col: number, rowSpan: number, colSpan: number) => { width: number; height: number };
    updateColumnWidth: (apertureId: number, columnIndex: number, newWidthMM: number) => void;
    updateRowHeight: (apertureId: number, rowIndex: number, newHeightMM: number) => void;
    selectedApertureElementIds: number[];
    toggleApertureElementSelection: (cellId: number, addToSelection?: boolean) => void;
    clearApertureElementIdSelection: () => void;
    mergeSelectedApertureElements: () => void;
    splitSelectedApertureElement: () => void;
    handleUpdateApertureElementFrameType: (params: {
        apertureId: number;
        elementId: number;
        framePosition: FramePosition;
        frameTypeId: string | null;
    }) => Promise<void>;
    updateApertureElementName: (elementId: number, newName: string) => Promise<void>;
    handleUpdateApertureElementGlazing: (params: { elementId: number; glazingTypeId: string | null }) => Promise<void>;
    handleUpdateApertureElementOperation: (elementId: number, operation: ElementOperation | null) => Promise<void>;
    handleUpdateApertureElementAssignments: (elementId: number, payload: ElementAssignmentsPayload) => Promise<void>;
}

const AperturesContext = createContext<AperturesContextType | undefined>(undefined);

export const AperturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    // --- TanStack Query: data fetching ---
    const { apertures, isLoadingApertures } = useAperturesQuery();

    // --- UI state ---
    const [selectedApertureId, setSelectedApertureId] = useState<number | null>(null);
    const [activeAperture, setActiveAperture] = useState<ApertureType | null>(null);
    const [selectedApertureElementIds, setSelectedApertureElementIds] = useState<number[]>([]);
    const [isMutating, setIsMutating] = useState(false);

    // --- Helpers ---
    const invalidateApertures = useCallback(() => {
        return queryClient.invalidateQueries({ queryKey: queryKeys.apertures(projectId || '') });
    }, [queryClient, projectId]);

    const updateApertureInCache = useCallback(
        (updatedAperture: ApertureType) => {
            queryClient.setQueryData<ApertureType[]>(queryKeys.apertures(projectId || ''), old =>
                old ? old.map(a => (a.id === updatedAperture.id ? updatedAperture : a)) : [updatedAperture]
            );
        },
        [queryClient, projectId]
    );

    // --- Select first aperture on initial load ---
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (!isLoadingApertures && !hasInitialized && apertures.length > 0) {
            setSelectedApertureElementIds([]);
            setSelectedApertureId(apertures[0].id);
            setActiveAperture(apertures[0]);
            setHasInitialized(true);
        } else if (!isLoadingApertures && !hasInitialized && apertures.length === 0) {
            setSelectedApertureId(null);
            setActiveAperture(null);
            setHasInitialized(true);
        }
    }, [isLoadingApertures, apertures, hasInitialized]);

    // Reset initialization when projectId changes
    useEffect(() => {
        setHasInitialized(false);
    }, [projectId]);

    // Sync activeAperture when apertures cache updates (after invalidation)
    useEffect(() => {
        if (selectedApertureId && apertures.length > 0) {
            const current = apertures.find(a => a.id === selectedApertureId);
            if (current) {
                setActiveAperture(current);
            }
        }
    }, [apertures, selectedApertureId]);

    // ----------------------------------------------------------------------------------
    // Active Aperture

    const handleSetActiveApertureById = useCallback(
        async (apertureId: number) => {
            setSelectedApertureElementIds([]);
            setSelectedApertureId(apertureId);
            const aperture = apertures.find(a => a.id === apertureId);
            if (aperture) {
                setActiveAperture(aperture);
            }
        },
        [apertures]
    );

    const handleSetActiveAperture = useCallback(async (aperture: ApertureType) => {
        setSelectedApertureElementIds([]);
        setActiveAperture(aperture);
        setSelectedApertureId(aperture.id);
    }, []);

    const updateActiveApertureData = useCallback(
        (aperture: ApertureType) => {
            setActiveAperture(aperture);
            updateApertureInCache(aperture);
        },
        [updateApertureInCache]
    );

    const handleUpdateAperture = useCallback(
        async (aperture: ApertureType) => {
            updateApertureInCache(aperture);
        },
        [updateApertureInCache]
    );

    // ----------------------------------------------------------------------------------
    // Edit Aperture and Element Grid

    const handleNameChange = useCallback(
        async (apertureId: number, newName: string) => {
            try {
                await ApertureService.updateApertureName(apertureId, newName);
                await invalidateApertures();
                handleSetActiveApertureById(apertureId);
            } catch (error) {
                console.error('Failed to update aperture name:', error);
                alert('Failed to update aperture name. Please try again.');
            }
        },
        [invalidateApertures, handleSetActiveApertureById]
    );

    const handleAddAperture = useCallback(async () => {
        try {
            const newAperture = await ApertureService.createAperture(projectId!);
            await invalidateApertures();
            handleSetActiveAperture(newAperture);
        } catch (error) {
            console.error('Failed to add aperture:', error);
            alert('Failed to add aperture. Please try again.');
        }
    }, [projectId, invalidateApertures, handleSetActiveAperture]);

    const handleDeleteAperture = useCallback(
        async (apertureId: number) => {
            try {
                const confirmed = window.confirm('Are you sure you want to delete the Aperture?');
                if (!confirmed) return;

                setIsMutating(true);
                await ApertureService.deleteAperture(apertureId);
                await invalidateApertures();

                // Read the updated cache to select the first aperture
                const updatedApertures =
                    queryClient.getQueryData<ApertureType[]>(queryKeys.apertures(projectId || '')) ?? [];
                if (updatedApertures.length > 0) {
                    handleSetActiveAperture(updatedApertures[0]);
                } else {
                    setSelectedApertureId(null);
                    setActiveAperture(null);
                }
            } catch (error) {
                console.error(`Failed to delete Aperture ${apertureId}:`, error);
                alert('Failed to delete aperture. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [invalidateApertures, handleSetActiveAperture, queryClient, projectId]
    );

    const handleDuplicateAperture = useCallback(
        async (apertureId: number) => {
            try {
                setIsMutating(true);
                const duplicatedAperture = await ApertureService.duplicateAperture(apertureId);
                await invalidateApertures();
                handleSetActiveAperture(duplicatedAperture);
                alert('Window unit duplicated successfully');
            } catch (error) {
                console.error('Failed to duplicate aperture:', error);
                alert('Failed to duplicate aperture. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [invalidateApertures, handleSetActiveAperture]
    );

    const handleAddRow = useCallback(
        async (position: InsertPosition = 'end') => {
            if (!activeAperture) return;
            try {
                setIsMutating(true);
                const updatedAperture = await ApertureService.addRow(activeAperture.id, position);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Error adding row:', error);
                alert('Failed to add row. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [activeAperture, updateActiveApertureData]
    );

    const handleDeleteRow = useCallback(
        async (rowNumber: number) => {
            if (!activeAperture) return;
            try {
                setIsMutating(true);
                const updatedAperture = await ApertureService.deleteRow(activeAperture.id, rowNumber);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Error deleting row:', error);
                alert('Failed to delete row. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [activeAperture, updateActiveApertureData]
    );

    const handleAddColumn = useCallback(
        async (position: InsertPosition = 'end') => {
            if (!activeAperture) return;
            try {
                setIsMutating(true);
                const updatedAperture = await ApertureService.addColumn(activeAperture.id, position);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Error adding column:', error);
                alert('Failed to add column. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [activeAperture, updateActiveApertureData]
    );

    const handleAddRowAtEdge = useCallback(
        (edge: 'top' | 'bottom') => {
            const position: InsertPosition = edge === 'top' ? 'start' : 'end';
            handleAddRow(position);
        },
        [handleAddRow]
    );

    const handleAddColumnAtEdge = useCallback(
        (edge: 'left' | 'right') => {
            const position: InsertPosition = edge === 'left' ? 'start' : 'end';
            handleAddColumn(position);
        },
        [handleAddColumn]
    );

    const handleDeleteColumn = useCallback(
        async (colNumber: number) => {
            if (!activeAperture) return;
            try {
                setIsMutating(true);
                const updatedAperture = await ApertureService.deleteColumn(activeAperture.id, colNumber);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Error deleting column:', error);
                alert('Failed to delete column. Please try again.');
            } finally {
                setIsMutating(false);
            }
        },
        [activeAperture, updateActiveApertureData]
    );

    // ----------------------------------------------------------------------------------
    // Grid Sizing

    const getCellSize = useCallback(
        (row: number, col: number, rowSpan: number, colSpan: number) => {
            if (!activeAperture) return { width: 0, height: 0 };
            const width = activeAperture.column_widths_mm.slice(col, col + colSpan).reduce((sum, w) => sum + w, 0);
            const height = activeAperture.row_heights_mm.slice(row, row + rowSpan).reduce((sum, h) => sum + h, 0);
            return { width, height };
        },
        [activeAperture]
    );

    const updateColumnWidth = useCallback(
        async (apertureId: number, columnIndex: number, newWidthMM: number) => {
            try {
                const updatedAperture = await ApertureService.updateColumnWidth(apertureId, columnIndex, newWidthMM);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture column width:', error);
                alert('Failed to update column width. Please try again.');
            }
        },
        [updateActiveApertureData]
    );

    const updateRowHeight = useCallback(
        async (apertureId: number, rowIndex: number, newHeightMM: number) => {
            try {
                const updatedAperture = await ApertureService.updateRowHeight(apertureId, rowIndex, newHeightMM);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture row height:', error);
                alert('Failed to update row height. Please try again.');
            }
        },
        [updateActiveApertureData]
    );

    // ----------------------------------------------------------------------------------
    // Frame-Type and Glass-Type

    const handleUpdateApertureElementFrameType = useCallback(
        async (params: {
            apertureId: number;
            elementId: number;
            framePosition: FramePosition;
            frameTypeId: string | null;
        }) => {
            try {
                const updatedAperture = await ApertureService.updateElementFrame(params);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element frame:', error);
                alert('Failed to update frame. Please try again.');
            }
        },
        [updateActiveApertureData]
    );

    const handleUpdateApertureElementGlazing = useCallback(
        async (params: { elementId: number; glazingTypeId: string | null }) => {
            try {
                const updatedAperture = await ApertureService.updateElementGlazing(params);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element glazing:', error);
                alert('Failed to update glazing. Please try again.');
            }
        },
        [updateActiveApertureData]
    );

    const handleUpdateApertureElementOperation = useCallback(
        async (elementId: number, operation: ElementOperation | null) => {
            try {
                const updatedAperture = await ApertureService.updateElementOperation(elementId, operation);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element operation:', error);
                alert('Failed to update operation. Please try again.');
            }
        },
        [updateActiveApertureData]
    );

    const handleUpdateApertureElementAssignments = useCallback(
        async (elementId: number, payload: ElementAssignmentsPayload) => {
            try {
                const updatedAperture = await ApertureService.updateElementAssignments(elementId, payload);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update element assignments:', error);
                throw error;
            }
        },
        [updateActiveApertureData]
    );

    // ----------------------------------------------------------------------------------
    // Cell Selection

    const toggleApertureElementSelection = useCallback(
        (elementId: number, addToSelection: boolean = false) => {
            setSelectedApertureElementIds(prev => {
                if (!activeAperture) return [];
                if (prev.includes(elementId)) return prev.filter(id => id !== elementId);
                if (!addToSelection) return [elementId];
                if (prev.length === 0) return [elementId];

                const element = getApertureElementById(activeAperture, elementId);
                if (!element) return prev;

                const isAdjacentToSelection = prev.some(selectedId => {
                    const selectedElement = getApertureElementById(activeAperture, selectedId);
                    return selectedElement && areElementsAdjacent(element, selectedElement);
                });

                return isAdjacentToSelection ? [...prev, elementId] : prev;
            });
        },
        [activeAperture]
    );

    const clearApertureElementIdSelection = useCallback(() => {
        setSelectedApertureElementIds([]);
    }, []);

    const mergeSelectedApertureElements = useCallback(async () => {
        try {
            if (!activeAperture) return;
            const updatedAperture = await ApertureService.mergeElements(activeAperture.id, selectedApertureElementIds);
            updateActiveApertureData(updatedAperture);
        } catch (error) {
            console.error('Failed to merge aperture elements:', error);
            alert('Failed to merge elements. Please try again.');
        } finally {
            clearApertureElementIdSelection();
        }
    }, [activeAperture, selectedApertureElementIds, clearApertureElementIdSelection, updateActiveApertureData]);

    const splitSelectedApertureElement = useCallback(async () => {
        try {
            if (!activeAperture) return;
            if (selectedApertureElementIds.length !== 1) {
                alert('You can only split one Aperture Element at a time.');
                return;
            }
            const updatedAperture = await ApertureService.splitElement(
                activeAperture.id,
                selectedApertureElementIds[0]
            );
            updateActiveApertureData(updatedAperture);
        } catch (error) {
            console.error('Failed to split aperture element:', error);
            alert('Failed to split element. Please try again.');
        } finally {
            clearApertureElementIdSelection();
        }
    }, [activeAperture, selectedApertureElementIds, clearApertureElementIdSelection, updateActiveApertureData]);

    // ----------------------------------------------------------------------------------
    // Aperture Element Name

    const updateApertureElementName = useCallback(
        async (elementId: number, newName: string) => {
            try {
                if (!activeAperture) return;
                const updatedAperture = await ApertureService.updateElementName(elementId, newName);
                updateActiveApertureData(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element:', error);
                alert('Failed to update element. Please try again.');
            }
        },
        [activeAperture, updateActiveApertureData]
    );

    const value = useMemo(
        () => ({
            isLoadingApertures: isLoadingApertures || isMutating,
            apertures,
            selectedApertureId,
            activeAperture,
            setSelectedApertureId,
            handleNameChange,
            handleSetActiveApertureById,
            handleSetActiveAperture,
            handleAddAperture,
            handleDeleteAperture,
            handleDuplicateAperture,
            handleUpdateAperture,
            handleAddRow,
            handleDeleteRow,
            handleAddColumn,
            handleDeleteColumn,
            handleAddRowAtEdge,
            handleAddColumnAtEdge,
            getCellSize,
            updateColumnWidth,
            updateRowHeight,
            selectedApertureElementIds,
            toggleApertureElementSelection,
            clearApertureElementIdSelection,
            mergeSelectedApertureElements,
            splitSelectedApertureElement,
            handleUpdateApertureElementFrameType,
            updateApertureElementName,
            handleUpdateApertureElementGlazing,
            handleUpdateApertureElementOperation,
            handleUpdateApertureElementAssignments,
        }),
        [
            isLoadingApertures,
            isMutating,
            apertures,
            selectedApertureId,
            activeAperture,
            handleNameChange,
            handleSetActiveApertureById,
            handleSetActiveAperture,
            handleAddAperture,
            handleDeleteAperture,
            handleDuplicateAperture,
            handleUpdateAperture,
            handleAddRow,
            handleDeleteRow,
            handleAddColumn,
            handleDeleteColumn,
            handleAddRowAtEdge,
            handleAddColumnAtEdge,
            getCellSize,
            updateColumnWidth,
            updateRowHeight,
            selectedApertureElementIds,
            toggleApertureElementSelection,
            clearApertureElementIdSelection,
            mergeSelectedApertureElements,
            splitSelectedApertureElement,
            handleUpdateApertureElementFrameType,
            updateApertureElementName,
            handleUpdateApertureElementGlazing,
            handleUpdateApertureElementOperation,
            handleUpdateApertureElementAssignments,
        ]
    );

    return <AperturesContext.Provider value={value}>{children}</AperturesContext.Provider>;
};

export const useApertures = (): AperturesContextType => {
    const context = useContext(AperturesContext);
    if (!context) {
        throw new Error('useApertures must be used within an AperturesProvider');
    }
    return context;
};
