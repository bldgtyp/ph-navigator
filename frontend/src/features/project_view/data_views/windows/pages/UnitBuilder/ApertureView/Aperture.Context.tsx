import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApertureElementType, ApertureType } from '../types';
import { getWithAlert } from '../../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';
import { patchWithAlert } from '../../../../../../../api/patchWithAlert';
import { deleteWithAlert } from '../../../../../../../api/deleteWithAlert';
import { postWithAlert } from '../../../../../../../api/postWithAlert';

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
            const fetchedApertures = await getWithAlert<ApertureType[]>(`aperture/get-apertures/${projectId}`);
            return fetchedApertures ?? [];
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
            await patchWithAlert(`aperture/update-aperture-name/${apertureId}`, null, {
                new_name: newName,
            });

            // Update the apertures state
            const updatedApertures = apertures.map(a => (a.id === apertureId ? { ...a, name: newName } : a));
            setApertures(updatedApertures);

            // Ensure the selected aperture is showing
            handleSetActiveApertureById(apertureId);
        } catch (error) {
            console.error('Failed to update aperture name:', error);
        }
    };

    const handleAddAperture = async () => {
        console.log(`handleAddAperture()`);
        try {
            const newAperture = await postWithAlert<ApertureType>(
                `aperture/create-new-aperture-on-project/${projectId}`
            );

            if (newAperture) {
                console.log(`Aperture added successfully: ${newAperture.id}`);
                const fetchedApertures = await fetchApertures();
                setApertures(fetchedApertures);
                handleSetActiveAperture(newAperture);
            }
        } catch (error) {
            console.error('Failed to add aperture:', error);
        }
    };

    const handleDeleteAperture = async (apertureId: number) => {
        console.log(`handleDeleteAperture(${apertureId})`);

        try {
            const confirmed = window.confirm('Are you sure you want to delete the Aperture?');
            if (!confirmed) return;

            await deleteWithAlert(`aperture/delete-aperture/${apertureId}`, null, {});

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
        }
    };

    const handleAddRow = useCallback(async () => {
        if (!activeAperture) return;

        try {
            setIsLoadingApertures(true);
            const updatedAperture = await patchWithAlert<ApertureType>(`aperture/add-row/${activeAperture.id}`);
            if (updatedAperture) {
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            }
        } catch (error) {
            const msg = `Error adding row: ${error}`;
            console.error(msg);
            alert(msg);
        } finally {
            setIsLoadingApertures(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAperture]);

    const handleDeleteRow = useCallback(
        async (rowNumber: number) => {
            if (!activeAperture) return;

            try {
                setIsLoadingApertures(true);
                const updatedAperture = await deleteWithAlert<ApertureType>(
                    `aperture/delete-row/${activeAperture.id}`,
                    null,
                    { row_number: rowNumber }
                );
                if (updatedAperture) {
                    handleUpdateAperture(updatedAperture);
                    handleSetActiveAperture(updatedAperture);
                }
            } catch (error) {
                const msg = `Error deleting row: ${error}`;
                console.error(msg);
                alert(msg);
            } finally {
                setIsLoadingApertures(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeAperture]
    );

    const handleAddColumn = useCallback(async () => {
        if (!activeAperture) return;

        try {
            setIsLoadingApertures(true);
            const updatedAperture = await patchWithAlert<ApertureType>(`aperture/add-column/${activeAperture.id}`);
            if (updatedAperture) {
                handleUpdateAperture(updatedAperture);
                handleSetActiveAperture(updatedAperture);
            }
        } catch (error) {
            const msg = `Error adding row: ${error}`;
            console.error(msg);
            alert(msg);
        } finally {
            setIsLoadingApertures(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAperture]);

    const handleDeleteColumn = useCallback(
        async (colNumber: number) => {
            if (!activeAperture) return;

            try {
                setIsLoadingApertures(true);
                const updatedAperture = await deleteWithAlert<ApertureType>(
                    `aperture/delete-column/${activeAperture.id}`,
                    null,
                    { column_number: colNumber }
                );
                if (updatedAperture) {
                    handleUpdateAperture(updatedAperture);
                    handleSetActiveAperture(updatedAperture);
                }
            } catch (error) {
                const msg = `Error deleting column: ${error}`;
                console.error(msg);
                alert(msg);
            } finally {
                setIsLoadingApertures(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                const updatedAperture = await patchWithAlert<ApertureType>(
                    `aperture/update-column-width/${apertureId}`,
                    null,
                    {
                        column_index: columnIndex,
                        new_width_mm: newWidthMM,
                    }
                );

                if (updatedAperture) {
                    console.log(`Aperture Column Updated successfully: ${updatedAperture.id}`);
                    const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                    setApertures(updatedApertures);
                    handleSetActiveAperture(updatedAperture);
                }
            } catch (error) {
                console.error('Failed to update aperture column width:', error);
            }
        },
        [apertures]
    );

    const updateRowHeight = useCallback(
        async (apertureId: number, rowIndex: number, newHeightMM: number) => {
            console.log(`updateRowHeight(${apertureId}, ${rowIndex}, ${newHeightMM})`);
            try {
                const updatedAperture = await patchWithAlert<ApertureType>(
                    `aperture/update-row-height/${apertureId}`,
                    null,
                    {
                        row_index: rowIndex,
                        new_height_mm: newHeightMM,
                    }
                );

                if (updatedAperture) {
                    console.log(`Aperture Row Updated successfully: ${updatedAperture.id}`);
                    const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                    setApertures(updatedApertures);
                    handleSetActiveAperture(updatedAperture);
                }
            } catch (error) {
                console.error('Failed to update aperture column width:', error);
            }
        },
        [apertures]
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
        console.log(`updateRowHeight()`);
        try {
            if (!activeAperture) {
                return null;
            }

            const updatedAperture = await patchWithAlert<ApertureType>(
                `aperture/merge-aperture-elements/${activeAperture.id}`,
                null,
                {
                    aperture_element_ids: selectedApertureElementIds,
                }
            );

            if (updatedAperture) {
                console.log(`Aperture Elements successfully merged: ${updatedAperture.id}`);
                const updatedApertures = apertures.map(a => (a.id === updatedAperture.id ? updatedAperture : a));
                setApertures(updatedApertures);
                handleSetActiveAperture(updatedAperture);
            }
        } catch (error) {
            console.error('Failed to merge aperture elements:', error);
        } finally {
            clearApertureElementIdSelection();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAperture, apertures, selectedApertureElementIds]);

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
