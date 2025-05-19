export interface MaterialDatasheetType {
    id: number;
    segment_id: number;
    full_size_url: string;
    thumbnail_url: string;
}

export interface MaterialDatasheetsType {
    datasheet_urls: MaterialDatasheetType[];
}
