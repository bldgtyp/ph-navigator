import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { MaterialSitePhotoType } from '../_types/Material.SitePhoto';
import { MaterialDatasheetType } from '../_types/Material.Datasheet';

interface MediaUrlsContextType {
    isLoadingMedia: boolean;
    sitePhotos: Map<number, MaterialSitePhotoType[]>;
    datasheets: Map<number, MaterialDatasheetType[]>;
    setMediaFromResponse: (response: ProjectMediaUrlsResponse) => void;
    addSitePhoto: (segmentId: number, photo: MaterialSitePhotoType) => void;
    removeSitePhoto: (segmentId: number, photoId: number) => void;
    addDatasheet: (segmentId: number, datasheet: MaterialDatasheetType) => void;
    removeDatasheet: (segmentId: number, datasheetId: number) => void;
    getSitePhotosForSegment: (segmentId: number) => MaterialSitePhotoType[];
    getDatasheetsForSegment: (segmentId: number) => MaterialDatasheetType[];
    setIsLoadingMedia: (loading: boolean) => void;
}

export interface ProjectMediaUrlsResponse {
    site_photos: Record<string, MaterialSitePhotoType[]>;
    datasheets: Record<string, MaterialDatasheetType[]>;
}

const MediaUrlsContext = createContext<MediaUrlsContextType | undefined>(undefined);

export const useMediaUrls = (): MediaUrlsContextType => {
    const context = useContext(MediaUrlsContext);
    if (!context) {
        throw new Error('useMediaUrls must be used within a MediaUrlsProvider');
    }
    return context;
};

interface MediaUrlsProviderProps {
    children: ReactNode;
}

export const MediaUrlsProvider: React.FC<MediaUrlsProviderProps> = ({ children }) => {
    const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);
    const [sitePhotos, setSitePhotos] = useState<Map<number, MaterialSitePhotoType[]>>(new Map());
    const [datasheets, setDatasheets] = useState<Map<number, MaterialDatasheetType[]>>(new Map());

    const setMediaFromResponse = useCallback((response: ProjectMediaUrlsResponse) => {
        // Convert response objects to Maps
        const photosMap = new Map<number, MaterialSitePhotoType[]>();
        for (const [segmentId, photos] of Object.entries(response.site_photos)) {
            photosMap.set(Number(segmentId), photos);
        }

        const datasheetsMap = new Map<number, MaterialDatasheetType[]>();
        for (const [segmentId, sheets] of Object.entries(response.datasheets)) {
            datasheetsMap.set(Number(segmentId), sheets);
        }

        setSitePhotos(photosMap);
        setDatasheets(datasheetsMap);
    }, []);

    const addSitePhoto = useCallback((segmentId: number, photo: MaterialSitePhotoType) => {
        setSitePhotos(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(segmentId) || [];
            newMap.set(segmentId, [...existing, photo]);
            return newMap;
        });
    }, []);

    const removeSitePhoto = useCallback((segmentId: number, photoId: number) => {
        setSitePhotos(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(segmentId) || [];
            newMap.set(
                segmentId,
                existing.filter(p => p.id !== photoId)
            );
            return newMap;
        });
    }, []);

    const addDatasheet = useCallback((segmentId: number, datasheet: MaterialDatasheetType) => {
        setDatasheets(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(segmentId) || [];
            newMap.set(segmentId, [...existing, datasheet]);
            return newMap;
        });
    }, []);

    const removeDatasheet = useCallback((segmentId: number, datasheetId: number) => {
        setDatasheets(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(segmentId) || [];
            newMap.set(
                segmentId,
                existing.filter(d => d.id !== datasheetId)
            );
            return newMap;
        });
    }, []);

    const getSitePhotosForSegment = useCallback(
        (segmentId: number): MaterialSitePhotoType[] => {
            return sitePhotos.get(segmentId) || [];
        },
        [sitePhotos]
    );

    const getDatasheetsForSegment = useCallback(
        (segmentId: number): MaterialDatasheetType[] => {
            return datasheets.get(segmentId) || [];
        },
        [datasheets]
    );

    const value: MediaUrlsContextType = {
        isLoadingMedia,
        sitePhotos,
        datasheets,
        setMediaFromResponse,
        addSitePhoto,
        removeSitePhoto,
        addDatasheet,
        removeDatasheet,
        getSitePhotosForSegment,
        getDatasheetsForSegment,
        setIsLoadingMedia,
    };

    return <MediaUrlsContext.Provider value={value}>{children}</MediaUrlsContext.Provider>;
};

export default MediaUrlsContext;
