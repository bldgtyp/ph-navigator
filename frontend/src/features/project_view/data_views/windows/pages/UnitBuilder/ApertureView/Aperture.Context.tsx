import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApertureType } from '../types';
import { getWithAlert } from '../../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';
import { patchWithAlert } from '../../../../../../../api/patchWithAlert';
import { deleteWithAlert } from '../../../../../../../api/deleteWithAlert';

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
    updateColumnWidth: (index: number, newWidth: number) => void;
    updateRowHeight: (index: number, newHeight: number) => void;
}

const AperturesContext = createContext<AperturesContextType | undefined>(undefined);

export const AperturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const [isLoadingApertures, setIsLoadingApertures] = useState<boolean>(true);
    const [apertures, setApertures] = useState<ApertureType[]>([]);
    const [selectedApertureId, setSelectedApertureId] = useState<number | null>(null);
    const [activeAperture, setActiveAperture] = useState<ApertureType | null>(null);

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
                handleSetActiveApertureById(fetchedApertures[0].id); // Set the first aperture as selected
            } else {
                setSelectedApertureId(null); // No apertures available
                setActiveAperture(null); // No active aperture
            }
        };

        initializeApertures();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

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

    const handleNameChange = () => {};

    const handleAddAperture = () => {};

    const handleDeleteAperture = () => {};

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
        (index: number, newWidth: number) => {
            // if (index < 0 || index >= gridData.columnWidths.length) return;
            // setGridData(prev => ({
            //     ...prev,
            //     columnWidths: prev.columnWidths.map((width, i) => (i === index ? newWidth : width)),
            // }));
        },
        []
        // [selectedAperture?.column_widths_mm]
    );

    const updateRowHeight = useCallback(
        (index: number, newHeight: number) => {
            // if (index < 0 || index >= selectedAperture.row_heights_mm.length) return;
            // setGridData(prev => ({
            //     ...prev,
            //     rowHeights: prev.rowHeights.map((height, i) => (i === index ? newHeight : height)),
            // }));
        },
        []
        // [selectedAperture?.row_heights_mm]
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
