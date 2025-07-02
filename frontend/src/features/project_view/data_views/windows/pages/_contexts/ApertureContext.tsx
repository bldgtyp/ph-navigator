import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApertureType } from '../UnitBuilder/types';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';

interface AperturesContextType {
    isLoadingApertures: boolean;
    setIsLoadingApertures: React.Dispatch<React.SetStateAction<boolean>>;
    apertures: ApertureType[];
    setApertures: React.Dispatch<React.SetStateAction<ApertureType[]>>;
    selectedAperture: ApertureType | null;
    selectedApertureId: number | null;
    setSelectedApertureId: React.Dispatch<React.SetStateAction<number | null>>;
    handleNameChange: (id: any, newName: string) => void;
    handleApertureChange: (id: any) => void;
    handleAddAperture: () => void;
    handleDeleteAperture: (id: any) => void;
}

const AperturesContext = createContext<AperturesContextType | undefined>(undefined);

export const AperturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const [isLoadingApertures, setIsLoadingApertures] = useState<boolean>(true);
    const [apertures, setApertures] = useState<ApertureType[]>([]);
    const [selectedApertureId, setSelectedApertureId] = useState<number | null>(null);

    const selectedAperture = useMemo(() => {
        return apertures.find(aperture => aperture.id === selectedApertureId) || null;
    }, [apertures, selectedApertureId]);

    const fetchApertures = async () => {
        console.log(`fetchApertures(), projectId=${projectId}`);
        try {
            const fetchedApertures = await getWithAlert<ApertureType[]>(`aperture/get-apertures/${projectId}`);
            setApertures(fetchedApertures ?? []);
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
            const fetchedApertures = await fetchApertures();
            if (fetchedApertures.length > 0) {
                setSelectedApertureId(fetchedApertures[0].id); // Set the first aperture as selected
            } else {
                setSelectedApertureId(null); // No apertures available
            }
        };

        initializeApertures();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const handleApertureChange = async (apertureId: number) => {
        console.log(`handleApertureChange() to apertureId=${apertureId}`);
        setSelectedApertureId(apertureId);
        await fetchApertures();
    };

    const handleNameChange = () => {};

    const handleAddAperture = () => {};

    const handleDeleteAperture = () => {};

    return (
        <AperturesContext.Provider
            value={{
                isLoadingApertures,
                setIsLoadingApertures,
                apertures,
                setApertures,
                selectedAperture,
                selectedApertureId,
                setSelectedApertureId,
                handleNameChange,
                handleApertureChange,
                handleAddAperture,
                handleDeleteAperture,
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
