export interface FanFields {
    DISPLAY_NAME: string;
    QUANTITY: number;
    ID_NUMBER: string;
    SERVICE: string;
    LOCATION: string;
    MANUFACTURER: string;
    MODEL: string;
    CFM: number;
    'VOLTS [V]': number;
    HP: number;
    'AMPS [A]': number;
    'ENERGY DEMAND [W]': number;
    LINK: string;
    SPECIFICATION: boolean;
    DATA_SHEET: string;
    NOTES: string;
    FLAG: string;
}

export interface FanRecord {
    id: string;
    createdTime: string;
    fields: FanFields;
}
