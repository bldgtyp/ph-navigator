export interface PumpsFields {
    DISPLAY_NAME: string;
    MANUFACTURER: string;
    MODEL: string;
    DATA_SHEET: string;
    SPECIFICATION: string;
}

export interface PumpsRecord {
    id: string;
    createdTime: string;
    fields: PumpsFields;
}
