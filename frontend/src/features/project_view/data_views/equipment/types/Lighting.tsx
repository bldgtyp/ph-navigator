export interface LightingFields {
    DISPLAY_NAME: string;
    ZONE: string;
    ENERGY_STAR: string;
    WATTS: number;
    LUMENS: number;
    SPECIFICATION: boolean;
    DATA_SHEET: string;
    LINK: string;
    NOTES: string;
    FLAG: string;
}

export interface LightingRecord {
    id: string;
    createdTime: string;
    fields: LightingFields;
}
