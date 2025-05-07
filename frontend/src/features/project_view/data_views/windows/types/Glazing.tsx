// ----------------------------------------------------------------------------
// Define the AirTable data types
type GlazingTypesFields = {
    DISPLAY_NAME: string;
    ZONE: string;
    MANUFACTURER: string;
    MODEL: string;
    "G-VALUE [%]": number;
    "U-VALUE [BTU/HR-FT2-F]": number;
    LINK: string;
    DATA_SHEET: string;
    SPECIFICATION: boolean;
    NOTES: string;
    FLAG: string;
};

type GlazingTypesRecord = { id: string; createdTime: string; fields: GlazingTypesFields };

export type { GlazingTypesRecord };