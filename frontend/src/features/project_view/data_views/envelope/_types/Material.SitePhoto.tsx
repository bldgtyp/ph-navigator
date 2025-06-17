export interface MaterialSitePhotoType {
    id: number;
    segment_id: number;
    thumbnail_url: string;
    full_size_url: string;
}

export interface MaterialSitePhotosType {
    photo_urls: MaterialSitePhotoType[];
}
