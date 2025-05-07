// ----------------------------------------------------------------------------
// Define the AirTable data types
type PumpsFields = {
    DISPLAY_NAME: string;
    MANUFACTURER: string;
    MODEL: string;
    DATA_SHEET: string;
    SPECIFICATION: string;
};

type PumpsRecord = { id: string; createdTime: string; fields: PumpsFields };
export type { PumpsRecord };