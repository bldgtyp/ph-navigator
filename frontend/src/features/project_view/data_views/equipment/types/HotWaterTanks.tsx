export interface DHWTankFields {
    DISPLAY_NAME: string;
    MANUFACTURER: string;
    MODEL: string;
    DATA_SHEET: string;
    SPECIFICATION: string;
}

export interface DHWTankRecord {
    id: string;
    createdTime: string;
    fields: DHWTankFields;
}
