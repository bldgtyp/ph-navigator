// ----------------------------------------------------------------------------
// Define the AirTable data types
type DHWTankFields = {
    DISPLAY_NAME: string;
    MANUFACTURER: string;
    MODEL: string;
    DATA_SHEET: string;
    SPECIFICATION: string;
};

type DHWTankRecord = { id: string; createdTime: string; fields: DHWTankFields };

export type { DHWTankRecord };