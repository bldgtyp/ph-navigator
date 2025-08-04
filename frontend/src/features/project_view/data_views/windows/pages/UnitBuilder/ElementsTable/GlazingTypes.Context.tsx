import { createContext, useContext, useEffect, useState } from 'react';

import { ApertureGlazingType } from '../types';
import { GlazingTypeService } from './services/glazingTypeService';

interface GlazingTypesContextType {
    isLoadingGlazingTypes: boolean;
    setIsLoadingGlazingTypes: React.Dispatch<React.SetStateAction<boolean>>;
    glazingTypes: ApertureGlazingType[];
    setGlazingTypes: React.Dispatch<React.SetStateAction<ApertureGlazingType[]>>;
    handleRefreshGlazingTypes: () => Promise<void>;
}

const GlazingTypesContext = createContext<GlazingTypesContextType | undefined>(undefined);

export const GlazingTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoadingGlazingTypes, setIsLoadingGlazingTypes] = useState<boolean>(true);
    const [glazingTypes, setGlazingTypes] = useState<ApertureGlazingType[]>([]);

    useEffect(() => {
        const loadGlazingTypes = async () => {
            try {
                setIsLoadingGlazingTypes(true);
                const glazingTypesData = await GlazingTypeService.loadGlazingTypes();
                setGlazingTypes(glazingTypesData);
            } catch (error) {
                console.error('Error loading glazing types:', error);
                alert('Error loading glazing data. Please try again later.');
            } finally {
                setIsLoadingGlazingTypes(false);
            }
        };

        loadGlazingTypes();
    }, []);

    const handleRefreshGlazingTypes = async () => {
        try {
            setIsLoadingGlazingTypes(true);
            const { glazingTypes: refreshedGlazingTypes, refreshInfo } =
                await GlazingTypeService.refreshGlazingTypesFromAirTable();

            setGlazingTypes(refreshedGlazingTypes);

            // Show success message to user
            alert(
                `Glazing types refreshed successfully: ${refreshInfo.types_added} added, ${refreshInfo.types_updated} updated. Total glazings: ${refreshInfo.types_total_count}`
            );
        } catch (error) {
            console.error('Error refreshing glazing types:', error);
            alert('Error refreshing glazing data. Please try again later.');
        } finally {
            setIsLoadingGlazingTypes(false);
        }
    };

    return (
        <GlazingTypesContext.Provider
            value={{
                isLoadingGlazingTypes,
                setIsLoadingGlazingTypes,
                glazingTypes,
                setGlazingTypes,
                handleRefreshGlazingTypes,
            }}
        >
            {children}
        </GlazingTypesContext.Provider>
    );
};

export const useGlazingTypes = (): GlazingTypesContextType => {
    const context = useContext(GlazingTypesContext);
    if (!context) {
        throw new Error('useGlazingTypes must be used within a GlazingTypesProvider');
    }
    return context;
};
