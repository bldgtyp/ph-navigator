import { createContext, useContext, useEffect, useState } from 'react';

import { ApertureElementFrameType } from '../types';
import { FrameTypeService } from './services/frameTypeService';

interface FrameTypesContextType {
    isLoadingFrameTypes: boolean;
    setIsLoadingFrameTypes: React.Dispatch<React.SetStateAction<boolean>>;
    frameTypes: ApertureElementFrameType[];
    setFrameTypes: React.Dispatch<React.SetStateAction<ApertureElementFrameType[]>>;
    handleRefreshFrameTypes: () => Promise<void>;
}

const FrameTypesContext = createContext<FrameTypesContextType | undefined>(undefined);

export const FrameTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoadingFrameTypes, setIsLoadingFrameTypes] = useState<boolean>(true);
    const [frameTypes, setFrameTypes] = useState<ApertureElementFrameType[]>([]);

    useEffect(() => {
        const loadFrameTypes = async () => {
            try {
                setIsLoadingFrameTypes(true);
                const frameTypesData = await FrameTypeService.loadFrameTypes();
                setFrameTypes(frameTypesData);
            } catch (error) {
                console.error('Error loading frame types:', error);
                alert('Error loading frame data. Please try again later.');
            } finally {
                setIsLoadingFrameTypes(false);
            }
        };

        loadFrameTypes();
    }, []);

    const handleRefreshFrameTypes = async () => {
        try {
            setIsLoadingFrameTypes(true);
            const { frameTypes: refreshedFrameTypes, refreshInfo } =
                await FrameTypeService.refreshFrameTypesFromAirTable();

            setFrameTypes(refreshedFrameTypes);

            // Show success message to user
            alert(
                `Frame types refreshed successfully: ${refreshInfo.frames_number_added} added, ${refreshInfo.frames_number_updated} updated. Total frames: ${refreshInfo.frame_total_count}`
            );
        } catch (error) {
            console.error('Error refreshing frame types:', error);
            alert('Error refreshing frame data. Please try again later.');
        } finally {
            setIsLoadingFrameTypes(false);
        }
    };

    return (
        <FrameTypesContext.Provider
            value={{
                isLoadingFrameTypes,
                setIsLoadingFrameTypes,
                frameTypes,
                setFrameTypes,
                handleRefreshFrameTypes,
            }}
        >
            {children}
        </FrameTypesContext.Provider>
    );
};

export const useFrameTypes = (): FrameTypesContextType => {
    const context = useContext(FrameTypesContext);
    if (!context) {
        throw new Error('useFrameTypes must be used within a FrameTypesProvider');
    }
    return context;
};
