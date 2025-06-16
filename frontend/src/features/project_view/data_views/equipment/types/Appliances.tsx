export interface AppliancesFields {
    DISPLAY_NAME: string;
    ZONE: string;
    DESCRIPTION: string;
    MANUFACTURER: string;
    MODEL: string;
    ENERGY_STAR: string;
    LINK: string;
    SPECIFICATION: boolean;
    DATA_SHEET: string;
    NOTES: string;
    FLAG: string;
}

export interface AppliancesRecord {
    id: string;
    createdTime: string;
    fields: AppliancesFields;
}
