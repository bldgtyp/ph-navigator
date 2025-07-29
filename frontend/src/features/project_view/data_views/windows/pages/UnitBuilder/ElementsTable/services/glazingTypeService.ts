import { getWithAlert } from '../../../../../../../../api/getWithAlert';
import { ApertureElementGlazingType } from '../../types';

const CACHE_KEY = 'glazings';
const CACHE_EXPIRY_KEY = 'glazings_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface RefreshResponseType {
    message: string;
    glazings_number_added: number;
    glazings_number_updated: number;
    glazing_total_count: number;
}

/**
 * Service layer for glazing type related API calls and caching
 * Separates API concerns from state management
 */
export class GlazingTypeService {
    /**
     * Fetch glazing types from the API and cache them locally
     */
    static async fetchAndCacheGlazingTypes(): Promise<ApertureElementGlazingType[]> {
        try {
            const glazings = await getWithAlert<ApertureElementGlazingType[]>('aperture/get-glazings');
            const glazingData = glazings || [];

            // Cache the data to local storage with expiry
            localStorage.setItem(CACHE_KEY, JSON.stringify(glazingData));
            localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());

            return glazingData;
        } catch (error) {
            console.error('Error fetching and caching glazing types:', error);
            throw new Error(`Failed to fetch glazing types: ${error}`);
        }
    }

    /**
     * Refresh glazing types from AirTable and cache the results
     */
    static async refreshGlazingTypesFromAirTable(): Promise<{
        glazingTypes: ApertureElementGlazingType[];
        refreshInfo: RefreshResponseType;
    }> {
        try {
            // Refresh the glazings from AirTable into the Database
            const response = await getWithAlert<RefreshResponseType>('aperture/refresh-db-glazings-from-air-table');

            if (!response) {
                throw new Error('No response received from AirTable refresh');
            }

            // Load the updated glazings from the database and cache them
            const glazingTypes = await this.fetchAndCacheGlazingTypes();

            return {
                glazingTypes,
                refreshInfo: response,
            };
        } catch (error) {
            console.error('Error refreshing glazing types from AirTable:', error);
            throw new Error(`Failed to refresh glazing types from AirTable: ${error}`);
        }
    }

    /**
     * Get cached glazing types if they exist and are not expired
     */
    static getCachedGlazingTypes(): ApertureElementGlazingType[] | null {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);

            if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
                return JSON.parse(cachedData);
            }

            return null;
        } catch (error) {
            console.error('Error reading cached glazing types:', error);
            return null;
        }
    }

    /**
     * Clear cached glazing types (useful for testing or manual cache invalidation)
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
     * Load glazing types with caching strategy
     * First tries cache, then fetches from API if needed
     */
    static async loadGlazingTypes(): Promise<ApertureElementGlazingType[]> {
        // Try to get from cache first
        const cachedGlazingTypes = this.getCachedGlazingTypes();

        if (cachedGlazingTypes) {
            return cachedGlazingTypes;
        }

        // Cache miss or expired, fetch from API
        return await this.fetchAndCacheGlazingTypes();
    }
}
