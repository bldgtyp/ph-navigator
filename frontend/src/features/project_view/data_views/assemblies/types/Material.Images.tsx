export interface SitePhotoType {
    thumbnail_url: string;
    full_size_url: string;
}


export interface SitePhotosType {
    photo_urls: SitePhotoType[];
}
