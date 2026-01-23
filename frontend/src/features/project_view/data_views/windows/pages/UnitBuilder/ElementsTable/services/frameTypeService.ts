import { getWithAlert } from '../../../../../../../../api/getWithAlert';
import { ApertureFrameType } from '../../types';

const CACHE_KEY = 'frames';
const CACHE_EXPIRY_KEY = 'frames_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface RefreshResponseType {
    message: string;
    types_added: number;
    types_updated: number;
    types_total_count: number;
}

/**
 * Service layer for frame type related API calls and caching
 * Separates API concerns from state management
 */
export class FrameTypeService {
    /**
     * Fetch frame types from the API and cache them locally
     */
    static async fetchAndCacheFrameTypes(): Promise<ApertureFrameType[]> {
        try {
            const frames = await getWithAlert<ApertureFrameType[]>('aperture/get-frame-types');
            const frameData = frames || [];

            // Cache the data to local storage with expiry
            localStorage.setItem(CACHE_KEY, JSON.stringify(frameData));
            localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());

            return frameData;
        } catch (error) {
            console.error('Error fetching and caching frame types:', error);
            throw new Error(`Failed to fetch frame types: ${error}`);
        }
    }

    /**
     * Refresh frame types from AirTable and cache the results
     */
    static async refreshFrameTypesFromAirTable(): Promise<{
        frameTypes: ApertureFrameType[];
        refreshInfo: RefreshResponseType;
    }> {
        try {
            // Refresh the frames from AirTable into the Database
            const response = await getWithAlert<RefreshResponseType>('aperture/refresh-db-frame-types-from-air-table');

            if (!response) {
                throw new Error('No response received from AirTable refresh');
            }

            // Clear existing cache before fetching new data
            this.clearCache();

            // Load the updated frames from the database and cache them
            const frameTypes = await this.fetchAndCacheFrameTypes();

            return {
                frameTypes,
                refreshInfo: response,
            };
        } catch (error) {
            console.error('Error refreshing frame types from AirTable:', error);
            throw new Error(`Failed to refresh frame types from AirTable: ${error}`);
        }
    }

    /**
     * Get cached frame types if they exist and are not expired
     */
    static getCachedFrameTypes(): ApertureFrameType[] | null {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);

            if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                return JSON.parse(cachedData);
            }

            return null;
        } catch (error) {
            console.error('Error reading cached frame types:', error);
            return null;
        }
    }

    /**
     * Clear cached frame types (useful for testing or manual cache invalidation)
     */
    static clearCache(): void {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
    }

    /**
     * Check if cached data exists and is valid
     */
    static isCacheValid(): boolean {
        const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
        return cachedExpiry ? Date.now() < parseInt(cachedExpiry) : false;
    }

    /**
     * Load frame types with caching strategy
     * First tries cache, then fetches from API if needed
     */
    static async loadFrameTypes(): Promise<ApertureFrameType[]> {
        // Try to get from cache first
        const cachedFrameTypes = this.getCachedFrameTypes();

        if (cachedFrameTypes) {
            return cachedFrameTypes;
        }

        // Cache miss or expired, fetch from API
        return await this.fetchAndCacheFrameTypes();
    }
}
