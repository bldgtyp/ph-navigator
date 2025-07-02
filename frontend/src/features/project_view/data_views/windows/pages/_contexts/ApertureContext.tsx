import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApertureType } from '../UnitBuilder/types';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';
import { patchWithAlert } from '../../../../../../api/patchWithAlert';
import { deleteWithAlert } from '../../../../../../api/deleteWithAlert';

interface AperturesContextType {
    isLoadingApertures: boolean;
    setIsLoadingApertures: React.Dispatch<React.SetStateAction<boolean>>;
    apertures: ApertureType[];
    setApertures: React.Dispatch<React.SetStateAction<ApertureType[]>>;
    selectedApertureId: number | null;
    activeAperture: ApertureType | null;
    setSelectedApertureId: React.Dispatch<React.SetStateAction<number | null>>;
    handleNameChange: (id: any, newName: string) => void;
    handleSetActiveApertureById: (id: any) => void;
    handleSetActiveAperture: (aperture: ApertureType) => void;
    handleAddAperture: () => void;
    handleDeleteAperture: (id: any) => void;
    handleUpdateAperture: (aperture: ApertureType) => void;
    handleAddRow: () => void;
    handleAddColumn: () => void;
    handleDeleteColumn: (index: number) => void;
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
        async (index: number) => {
            if (!activeAperture) return;

            try {
                setIsLoadingApertures(true);
                const updatedAperture = await deleteWithAlert<ApertureType>(
                    `aperture/delete-column/${activeAperture.id}`,
                    null,
                    { column_number: index }
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
                handleAddColumn,
                handleDeleteColumn,
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
