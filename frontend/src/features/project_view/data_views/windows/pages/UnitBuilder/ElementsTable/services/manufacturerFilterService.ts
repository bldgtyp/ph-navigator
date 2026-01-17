import { getWithAlert } from '../../../../../../../../api/getWithAlert';
import { patchWithAlert } from '../../../../../../../../api/patchWithAlert';
import { ManufacturerFilterConfig } from '../../types';

const CACHE_KEY_PREFIX = 'manufacturer_filters_';
const CACHE_EXPIRY_PREFIX = 'manufacturer_filters_expiry_';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export class ManufacturerFilterService {
    private static getCacheKey(projectKey: string): string {
        return `${CACHE_KEY_PREFIX}${projectKey}`;
    }

    private static getCacheExpiryKey(projectKey: string): string {
        return `${CACHE_EXPIRY_PREFIX}${projectKey}`;
    }

    static async fetchAndCacheFilters(projectKey: string): Promise<ManufacturerFilterConfig> {
        try {
            const filters = await getWithAlert<ManufacturerFilterConfig>(`aperture/manufacturer-filters/${projectKey}`);

            if (!filters) {
                throw new Error('No filter configuration received');
            }

            localStorage.setItem(this.getCacheKey(projectKey), JSON.stringify(filters));
            localStorage.setItem(this.getCacheExpiryKey(projectKey), (Date.now() + CACHE_DURATION).toString());

            return filters;
        } catch (error) {
            console.error('Error fetching manufacturer filters:', error);
            throw new Error(`Failed to fetch manufacturer filters: ${error}`);
        }
    }

    static async updateFilters(
        projectKey: string,
        enabledFrameManufacturers: string[],
        enabledGlazingManufacturers: string[]
    ): Promise<ManufacturerFilterConfig> {
        try {
            const updatedFilters = await patchWithAlert<ManufacturerFilterConfig>(
                `aperture/manufacturer-filters/${projectKey}`,
                null,
                {
                    enabled_frame_manufacturers: enabledFrameManufacturers,
                    enabled_glazing_manufacturers: enabledGlazingManufacturers,
                }
            );

            if (!updatedFilters) {
                throw new Error('No response received from filter update');
            }

            localStorage.setItem(this.getCacheKey(projectKey), JSON.stringify(updatedFilters));
            localStorage.setItem(this.getCacheExpiryKey(projectKey), (Date.now() + CACHE_DURATION).toString());

            return updatedFilters;
        } catch (error) {
            console.error('Error updating manufacturer filters:', error);
            throw new Error(`Failed to update manufacturer filters: ${error}`);
        }
    }

    static getCachedFilters(projectKey: string): ManufacturerFilterConfig | null {
        try {
            const cachedData = localStorage.getItem(this.getCacheKey(projectKey));
            const cachedExpiry = localStorage.getItem(this.getCacheExpiryKey(projectKey));

            if (cachedData && cachedExpiry && Date.now() < parseInt(cachedExpiry, 10)) {
                return JSON.parse(cachedData);
            }

            return null;
        } catch (error) {
            console.error('Error reading cached manufacturer filters:', error);
            return null;
        }
    }

    static clearCache(projectKey: string): void {
        localStorage.removeItem(this.getCacheKey(projectKey));
        localStorage.removeItem(this.getCacheExpiryKey(projectKey));
    }

    static async loadFilters(projectKey: string): Promise<ManufacturerFilterConfig> {
        const cachedFilters = this.getCachedFilters(projectKey);

        if (cachedFilters) {
            return cachedFilters;
        }

        return await this.fetchAndCacheFilters(projectKey);
    }
}
