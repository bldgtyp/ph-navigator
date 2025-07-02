import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApertureType } from '../UnitBuilder/types';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';

interface AperturesContextType {
    isLoadingApertures: boolean;
    setIsLoadingApertures: React.Dispatch<React.SetStateAction<boolean>>;
    apertures: ApertureType[];
    setApertures: React.Dispatch<React.SetStateAction<ApertureType[]>>;
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

    useEffect(() => {
        async function loadProjectData() {
            try {
                // Check if cached data exists and is not expired
                const cachedData = localStorage.getItem('Apertures');
                const cachedExpiry = localStorage.getItem('Apertures_expiry');

                if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                    setApertures(JSON.parse(cachedData));
                } else {
                    // Fetch and cache Apertures if no valid cache exists
                    const fetchedApertures = await getWithAlert<ApertureType[]>(`aperture/get-apertures/${projectId}`);
                    if (!fetchedApertures) {
                        throw new Error('No Apertures data found');
                    }
                    setApertures(fetchedApertures);
                }
            } catch (error) {
                alert('Error loading Apertures Data. Please try again later.');
                console.error('Error loading Apertures Data:', error);
            } finally {
                setIsLoadingApertures(false);
            }
        }

        loadProjectData();
    }, [projectId]);

    const handleNameChange = () => {};

    const handleApertureChange = () => {};

    const handleAddAperture = () => {};

    const handleDeleteAperture = () => {};

    return (
        <AperturesContext.Provider
            value={{
                isLoadingApertures,
                setIsLoadingApertures,
                apertures,
                setApertures,
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
