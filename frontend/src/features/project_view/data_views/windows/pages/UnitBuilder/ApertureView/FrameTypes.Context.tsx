import React, { createContext, useContext, useEffect, useState } from 'react';
import { getWithAlert } from '../../../../../../../api/getWithAlert';
import { ApertureElementFrameType } from '../types';
import { patchWithAlert } from '../../../../../../../api/patchWithAlert';

const cacheKey = 'frames';
const cacheExpiryKey = 'frames_expiry';
const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

interface RefreshResponseType {
    message: string;
    frames_number_added: number;
    frames_number_updated: number;
    frame_total_count: number;
}

interface FrameTypesContextType {
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    frameTypes: ApertureElementFrameType[];
    setFrameTypes: React.Dispatch<React.SetStateAction<ApertureElementFrameType[]>>;
    handleRefreshFrameTypes: () => Promise<void>;
}

export const fetchAndCacheFrameTypes = async (): Promise<ApertureElementFrameType[]> => {
    try {
        // Fetch frames from the database
        const frames = await getWithAlert<ApertureElementFrameType[]>('aperture/get-frames');

        // Cache the data to local-storage and set expiry
        localStorage.setItem(cacheKey, JSON.stringify(frames || []));
        localStorage.setItem(cacheExpiryKey, (Date.now() + cacheDuration).toString());

        return frames || [];
    } catch (error) {
        console.error('Error fetching and caching frames:', error);
        throw error;
    }
};

export const refreshFramesTypesFromAirTable = async (): Promise<ApertureElementFrameType[]> => {
    try {
        // Refresh the frames from AirTable into the Database
        const response = await getWithAlert<RefreshResponseType>('aperture/refresh-db-frames-from-air-table');
        if (!response) {
            throw new Error('Error refreshing frames from AirTable.');
        } else {
            alert(
                `Frame-Types refreshed successfully: ${response.frames_number_added} added, ${response.frames_number_updated} updated. Total frames: ${response.frame_total_count}`
            );
        }

        // Load the Frames from the Database to local-storage
        const framesTypes = await fetchAndCacheFrameTypes();

        return framesTypes;
    } catch (error) {
        console.error('Error Refreshing Frame-Types from AirTable:', error);
        throw error;
    }
};

const FrameTypesContext = createContext<FrameTypesContextType | undefined>(undefined);

export const FrameTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [frameTypes, setFrameTypes] = useState<ApertureElementFrameType[]>([]);

    useEffect(() => {
        async function loadProjectData() {
            try {
                setIsLoading(true);

                // Check if cached data exists and is not expired
                const cachedData = localStorage.getItem('ApertureElementFrames');
                const cachedExpiry = localStorage.getItem('ApertureElementFrames_expiry');

                if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                    setFrameTypes(JSON.parse(cachedData));
                } else {
                    // Fetch and cache ApertureElementFrames if no valid cache exists
                    const fetchedApertureElementFrames = await fetchAndCacheFrameTypes();
                    setFrameTypes(fetchedApertureElementFrames);
                }
            } catch (error) {
                alert('Error loading Frame Data. Please try again later.');
                console.error('Error loading Frame Data:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadProjectData();
    }, []);

    const handleRefreshFrameTypes = async () => {
        try {
            setIsLoading(true);

            // Fetch and cache ApertureElementFrames if no valid cache exists
            const fetchedApertureElementFrames = await refreshFramesTypesFromAirTable();
            setFrameTypes(fetchedApertureElementFrames);
        } catch (error) {
            alert('Error refreshing Frame Data. Please try again later.');
            console.error('Error refreshing Frame Data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <FrameTypesContext.Provider
            value={{
                isLoading,
                setIsLoading,
                frameTypes,
                setFrameTypes,
                handleRefreshFrameTypes: handleRefreshFrameTypes,
            }}
        >
            {children}
        </FrameTypesContext.Provider>
    );
};

export const useFrameTypes = (): FrameTypesContextType => {
    const context = useContext(FrameTypesContext);
    if (!context) {
        throw new Error('useFrameTypes must be used within a FrameTypesContextType');
    }
    return context;
};
