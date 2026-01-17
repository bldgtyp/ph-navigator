import { ManufacturerFilterService } from '../manufacturerFilterService';

const CACHE_KEY_PREFIX = 'manufacturer_filters_';
const CACHE_EXPIRY_PREFIX = 'manufacturer_filters_expiry_';

const buildCacheKey = (projectKey: string) => `${CACHE_KEY_PREFIX}${projectKey}`;
const buildExpiryKey = (projectKey: string) => `${CACHE_EXPIRY_PREFIX}${projectKey}`;

const sampleConfig = {
    available_frame_manufacturers: ['Alpen', 'Intus'],
    enabled_frame_manufacturers: ['Alpen'],
    available_glazing_manufacturers: ['Guardian', 'Saint-Gobain'],
    enabled_glazing_manufacturers: ['Guardian'],
    used_frame_manufacturers: ['Alpen'],
    used_glazing_manufacturers: [],
};

describe('ManufacturerFilterService cache', () => {
    const projectKey = '2305';

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it('returns cached filters when not expired', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1000);
        localStorage.setItem(buildCacheKey(projectKey), JSON.stringify(sampleConfig));
        localStorage.setItem(buildExpiryKey(projectKey), '2000');

        const result = ManufacturerFilterService.getCachedFilters(projectKey);

        expect(result).toEqual(sampleConfig);
    });

    it('returns null when cache is expired', () => {
        jest.spyOn(Date, 'now').mockReturnValue(3000);
        localStorage.setItem(buildCacheKey(projectKey), JSON.stringify(sampleConfig));
        localStorage.setItem(buildExpiryKey(projectKey), '2000');

        const result = ManufacturerFilterService.getCachedFilters(projectKey);

        expect(result).toBeNull();
    });

    it('clears cached entries', () => {
        localStorage.setItem(buildCacheKey(projectKey), JSON.stringify(sampleConfig));
        localStorage.setItem(buildExpiryKey(projectKey), '2000');

        ManufacturerFilterService.clearCache(projectKey);

        expect(localStorage.getItem(buildCacheKey(projectKey))).toBeNull();
        expect(localStorage.getItem(buildExpiryKey(projectKey))).toBeNull();
    });
});
