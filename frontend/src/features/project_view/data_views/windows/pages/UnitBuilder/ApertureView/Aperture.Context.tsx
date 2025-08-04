import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApertureElementType, ApertureType } from '../types';
import { FramePosition } from '../ElementsTable/types';
import { ApertureService } from './services/apertureService';

function getApertureElementById(aperture: ApertureType, elementId: number): ApertureElementType | undefined {
    return aperture.elements.find(element => element.id === elementId);
}

interface AperturesContextType {
    isLoadingApertures: boolean;
    setIsLoadingApertures: React.Dispatch<React.SetStateAction<boolean>>;
    // Aperture Collection
    apertures: ApertureType[];
    setApertures: React.Dispatch<React.SetStateAction<ApertureType[]>>;
    selectedApertureId: number | null;
    activeAperture: ApertureType | null;
    setSelectedApertureId: React.Dispatch<React.SetStateAction<number | null>>;
    handleSetActiveApertureById: (id: any) => void;
    handleSetActiveAperture: (aperture: ApertureType) => void;
    // Sizing
    handleNameChange: (id: any, newName: string) => void;
    handleAddAperture: () => void;
    handleDeleteAperture: (id: any) => void;
    handleUpdateAperture: (aperture: ApertureType) => void;
    handleAddRow: () => void;
    handleDeleteRow: (index: number) => void;
    handleAddColumn: () => void;
    handleDeleteColumn: (index: number) => void;
    // Sizing
    getCellSize: (row: number, col: number, rowSpan: number, colSpan: number) => { width: number; height: number };
    updateColumnWidth: (apertureId: number, columnIndex: number, newWidthMM: number) => void;
    updateRowHeight: (apertureId: number, rowIndex: number, newHeightMM: number) => void;
    // Selection
    selectedApertureElementIds: number[];
    toggleApertureElementSelection: (cellId: number) => void;
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
    handleUpdateApertureElementGlazing: (params: { elementId: number; glazingId: number | null }) => Promise<void>;
}

const AperturesContext = createContext<AperturesContextType | undefined>(undefined);

export const AperturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const [isLoadingApertures, setIsLoadingApertures] = useState<boolean>(true);
    const [apertures, setApertures] = useState<ApertureType[]>([]);
    const [selectedApertureId, setSelectedApertureId] = useState<number | null>(null);
    const [activeAperture, setActiveAperture] = useState<ApertureType | null>(null);
    const [selectedApertureElementIds, setSelectedApertureElementsIds] = useState<number[]>([]);

    const fetchApertures = async () => {
        console.log(`fetchApertures(), projectId=${projectId}`);
        try {
            const fetchedApertures = await ApertureService.fetchAperturesByProject(projectId!);
            return fetchedApertures;
        } catch (error) {
            const msg = `Error loading Apertures Data ${error}`;
            console.error(msg);
            alert(msg);
            return [];
        } finally {
            setIsLoadingApertures(false);
        }
    };

    useEffect(() => {
        const initializeApertures = async () => {
            console.log(`initializeApertures() for projectId=${projectId}`);
            const fetchedApertures = await fetchApertures();
            setApertures(fetchedApertures);

            if (fetchedApertures.length > 0) {
                // Set the first aperture as selected
                handleSetActiveApertureById(fetchedApertures[0].id);
                setActiveAperture(fetchedApertures[0]);
            } else {
                setSelectedApertureId(null); // No apertures available
                setActiveAperture(null); // No active aperture
            }
        };

        initializeApertures();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // ----------------------------------------------------------------------------------
    // Active Aperture

    const handleSetActiveApertureById = async (apertureId: number) => {
        // Used when the user selects an aperture from a list or dropdown
        console.log(`handleSetActiveApertureById() to apertureId=${apertureId}`);
        setSelectedApertureElementsIds([]);
        setSelectedApertureId(apertureId);
        const aperture = apertures.find(a => a.id === apertureId);
        if (aperture) {
            setActiveAperture(aperture);
        } else {
            console.warn(`Aperture with id ${apertureId} not found in current apertures.`);
        }
    };

    const handleSetActiveAperture = async (aperture: ApertureType) => {
        console.log(`handleSetActiveAperture() to apertureId=${aperture.id}`);
        setSelectedApertureElementsIds([]);
        setActiveAperture(aperture);
        setSelectedApertureId(aperture.id);
    };

    const handleUpdateAperture = async (aperture: ApertureType) => {
        // Update an aperture's values in the 'apertures' state collection
        setApertures(prevApertures => prevApertures.map(a => (a.id === aperture.id ? { ...a, ...aperture } : a)));
    };

    // ----------------------------------------------------------------------------------
    // Edit Aperture and Element Grid

    const handleNameChange = async (apertureId: number, newName: string) => {
        console.log(`handleNameChange(${apertureId}, ${newName})`);
        try {
            await ApertureService.updateApertureName(apertureId, newName);

            // Update the apertures state
            const updatedApertures = apertures.map(a => (a.id === apertureId ? { ...a, name: newName } : a));
            setApertures(updatedApertures);

            // Ensure the selected aperture is showing
            handleSetActiveApertureById(apertureId);
        } catch (error) {
            console.error('Failed to update aperture name:', error);
            alert('Failed to update aperture name. Please try again.');
        }
    };

    const handleAddAperture = async () => {
        console.log(`handleAddAperture()`);
        try {
            const newAperture = await ApertureService.createAperture(projectId!);

            console.log(`Aperture added successfully: ${newAperture.id}`);
            const fetchedApertures = await fetchApertures();
            setApertures(fetchedApertures);
            handleSetActiveAperture(newAperture);
        } catch (error) {
            console.error('Failed to add aperture:', error);
            alert('Failed to add aperture. Please try again.');
        }
    };

    const handleDeleteAperture = async (apertureId: number) => {
        console.log(`handleDeleteAperture(${apertureId})`);

        try {
            const confirmed = window.confirm('Are you sure you want to delete the Aperture?');
            if (!confirmed) return;

            await ApertureService.deleteAperture(apertureId);

            console.log(`Aperture ${apertureId} deleted successfully.`);

            // Fetch updated apertures and update the state
            const fetchedApertures = await fetchApertures();
            setApertures(fetchedApertures);

            // Select the first aperture in the updated list, or set to null if none remain
            if (fetchedApertures.length > 0) {
                handleSetActiveAperture(fetchedApertures[0]);
            } else {
                setSelectedApertureId(null);
            }
        } catch (error) {
            console.error(`Failed to delete Aperture ${apertureId}:`, error);
            alert('Failed to delete aperture. Please try again.');
        }
    };

    const handleAddRow = useCallback(async () => {
        if (!activeAperture) return;

        try {
            setIsLoadingApertures(true);
            const updatedAperture = await ApertureService.addRow(activeAperture.id);
            handleUpdateAperture(updatedAperture);
            handleSetActiveAperture(updatedAperture);
        } catch (error) {
            console.error('Error adding row:', error);
            alert('Failed to add row. Please try again.');
        } finally {
            setIsLoadingApertures(false);
        }
    }, [activeAperture]);

    const handleDeleteRow = useCallback(
        async (rowNumber: number) => {
            if (!activeAperture) return;

            try {
                setIsLoadingApertures(true);
                const updatedAperture = await ApertureService.deleteRow(activeAperture.id, rowNumber);
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Error deleting row:', error);
                alert('Failed to delete row. Please try again.');
            } finally {
                setIsLoadingApertures(false);
            }
        },
        [activeAperture]
    );

    const handleAddColumn = useCallback(async () => {
        if (!activeAperture) return;

        try {
            setIsLoadingApertures(true);
            const updatedAperture = await ApertureService.addColumn(activeAperture.id);
            handleUpdateAperture(updatedAperture);
            handleSetActiveAperture(updatedAperture);
        } catch (error) {
            console.error('Error adding column:', error);
            alert('Failed to add column. Please try again.');
        } finally {
            setIsLoadingApertures(false);
        }
    }, [activeAperture]);

    const handleDeleteColumn = useCallback(
        async (colNumber: number) => {
            if (!activeAperture) return;

            try {
                setIsLoadingApertures(true);
                const updatedAperture = await ApertureService.deleteColumn(activeAperture.id, colNumber);
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Error deleting column:', error);
                alert('Failed to delete column. Please try again.');
            } finally {
                setIsLoadingApertures(false);
            }
        },
        [activeAperture]
    );

    // ----------------------------------------------------------------------------------
    // Grid Sizing

    const getCellSize = useCallback(
        (row: number, col: number, rowSpan: number, colSpan: number) => {
            if (!activeAperture) return { width: 0, height: 0 };
            const width = activeAperture?.column_widths_mm.slice(col, col + colSpan).reduce((sum, w) => sum + w, 0);
            const height = activeAperture?.row_heights_mm.slice(row, row + rowSpan).reduce((sum, h) => sum + h, 0);
            return { width, height };
        },
        [activeAperture]
    );

    const updateColumnWidth = useCallback(
        async (apertureId: number, columnIndex: number, newWidthMM: number) => {
            console.log(`updateColumnWidth(${apertureId}, ${columnIndex}, ${newWidthMM})`);
            try {
                const updatedAperture = await ApertureService.updateColumnWidth(apertureId, columnIndex, newWidthMM);

                console.log(`Aperture Column Updated successfully: ${updatedAperture.id}`);
                const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                setApertures(updatedApertures);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture column width:', error);
                alert('Failed to update column width. Please try again.');
            }
        },
        [apertures]
    );

    const updateRowHeight = useCallback(
        async (apertureId: number, rowIndex: number, newHeightMM: number) => {
            console.log(`updateRowHeight(${apertureId}, ${rowIndex}, ${newHeightMM})`);
            try {
                const updatedAperture = await ApertureService.updateRowHeight(apertureId, rowIndex, newHeightMM);

                console.log(`Aperture Row Updated successfully: ${updatedAperture.id}`);
                const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                setApertures(updatedApertures);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture row height:', error);
                alert('Failed to update row height. Please try again.');
            }
        },
        [apertures]
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
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element frame:', error);
                alert('Failed to update frame. Please try again.');
            }
        },
        []
    );

    const handleUpdateApertureElementGlazing = useCallback(
        async (params: { elementId: number; glazingId: number | null }) => {
            try {
                const updatedAperture = await ApertureService.updateElementGlazing(params);
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element glazing:', error);
                alert('Failed to update glazing. Please try again.');
            }
        },
        []
    );

    // ----------------------------------------------------------------------------------
    // Cell Selection

    const toggleApertureElementSelection = useCallback(
        (elementId: number) => {
            setSelectedApertureElementsIds(prev => {
                if (!activeAperture) {
                    return [];
                } else if (prev.includes(elementId)) {
                    // Deselect if already selected
                    return prev.filter(id => id !== elementId);
                } else {
                    // Only allow selecting adjacent ApertureElement (ApertureElement that share an edge)
                    if (prev.length === 0) {
                        // First selection is always valid
                        return [elementId];
                    }

                    // Check if this ApertureElement is adjacent to any selected ApertureElement
                    const element = getApertureElementById(activeAperture, elementId);
                    if (!element) return prev;

                    // Check adjacency with any selected ApertureElement
                    for (const selectedId of prev) {
                        const selectedCell = getApertureElementById(activeAperture, selectedId);
                        if (!selectedCell) continue;

                        // Check if cells are adjacent (share an edge)
                        const isAdjacent =
                            // Horizontally adjacent
                            (element.row_number === selectedCell.row_number &&
                                (Math.abs(element.column_number - selectedCell.column_number) === 1 ||
                                    Math.abs(element.column_number + element.col_span - selectedCell.column_number) ===
                                        0 ||
                                    Math.abs(
                                        element.column_number - (selectedCell.column_number + selectedCell.col_span)
                                    ) === 0)) ||
                            // Vertically adjacent
                            (element.column_number === selectedCell.column_number &&
                                (Math.abs(element.row_number - selectedCell.row_number) === 1 ||
                                    Math.abs(element.row_number + element.row_span - selectedCell.row_number) === 0 ||
                                    Math.abs(element.row_number - (selectedCell.row_number + selectedCell.row_span)) ===
                                        0));

                        if (isAdjacent) {
                            return [...prev, elementId];
                        }
                    }

                    // If we get here, the cell isn't adjacent to any selected cell
                    return prev;
                }
            });
        },
        [activeAperture]
    );

    const clearApertureElementIdSelection = useCallback(() => {
        setSelectedApertureElementsIds([]);
    }, []);

    const mergeSelectedApertureElements = useCallback(async () => {
        console.log(`mergeSelectedApertureElements()`);
        try {
            if (!activeAperture) {
                return;
            }

            const updatedAperture = await ApertureService.mergeElements(activeAperture.id, selectedApertureElementIds);

            console.log(`Aperture Elements successfully merged: ${updatedAperture.id}`);
            const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
            setApertures(updatedApertures);
            handleSetActiveAperture(updatedAperture);
        } catch (error) {
            console.error('Failed to merge aperture elements:', error);
            alert('Failed to merge elements. Please try again.');
        } finally {
            clearApertureElementIdSelection();
        }
    }, [activeAperture, apertures, selectedApertureElementIds, clearApertureElementIdSelection]);

    const splitSelectedApertureElement = useCallback(async () => {
        console.log(`splitSelectedApertureElement()`);
        try {
            if (!activeAperture) {
                return;
            }

            if (selectedApertureElementIds.length !== 1) {
                console.warn('You can only split one Aperture Element at a time.');
                alert('You can only split one Aperture Element at a time.');
                return;
            }

            const updatedAperture = await ApertureService.splitElement(
                activeAperture.id,
                selectedApertureElementIds[0]
            );

            console.log(`Aperture Element successfully split: ${updatedAperture.id}`);
            const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
            setApertures(updatedApertures);
            handleSetActiveAperture(updatedAperture);
        } catch (error) {
            console.error('Failed to split aperture element:', error);
            alert('Failed to split element. Please try again.');
        } finally {
            clearApertureElementIdSelection();
        }
    }, [activeAperture, apertures, selectedApertureElementIds, clearApertureElementIdSelection]);

    // ----------------------------------------------------------------------------------
    // Aperture Element Name

    const updateApertureElementName = useCallback(
        async (elementId: number, newName: string) => {
            console.log(`updateApertureElementName()`);
            try {
                if (!activeAperture) {
                    return;
                }

                const updatedAperture = await ApertureService.updateElementName(elementId, newName);

                console.log(`Aperture Element successfully updated: ${updatedAperture.id}`);
                const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                setApertures(updatedApertures);
                handleSetActiveAperture(updatedAperture);
            } catch (error) {
                console.error('Failed to update aperture element:', error);
                alert('Failed to update element. Please try again.');
            } finally {
                clearApertureElementIdSelection();
            }
        },
        [activeAperture, apertures, clearApertureElementIdSelection]
    );

    return (
        <AperturesContext.Provider
            value={{
                isLoadingApertures,
                setIsLoadingApertures,
                apertures,
                setApertures,
                selectedApertureId,
                activeAperture,
                setSelectedApertureId,
                handleNameChange,
                handleSetActiveApertureById,
                handleSetActiveAperture,
                handleAddAperture,
                handleDeleteAperture,
                handleUpdateAperture,
                handleAddRow,
                handleDeleteRow,
                handleAddColumn,
                handleDeleteColumn,
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
            }}
        >
            {children}
        </AperturesContext.Provider>
    );
};

export const useApertures = (): AperturesContextType => {
    const context = useContext(AperturesContext);
    if (!context) {
        throw new Error('useApertures must be used within an AperturesProvider');
    }
    return context;
};
