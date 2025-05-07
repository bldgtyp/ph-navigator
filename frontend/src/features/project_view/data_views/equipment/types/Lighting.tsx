
// ----------------------------------------------------------------------------
// Define the AirTable data types
type LightingFields = {
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
};

type LightingRecord = { id: string; createdTime: string; fields: LightingFields };

export type { LightingRecord };