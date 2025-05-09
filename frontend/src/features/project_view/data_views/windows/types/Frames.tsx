export interface FrameTypesFields {
    DISPLAY_NAME: string;
    MANUFACTURER: string;
    MODEL: string;
    OPERATION: string;
    LOCATION: string;
    "U-VALUE [BTU/HR-FT2-F]": number;
    "WIDTH [IN]": number;
    "PSI-GLAZING [BTU/HR-FT-F]": number;
    LINK: string;
    SPECIFICATION: boolean;
    DATA_SHEET: string;
    NOTES: string;
    FLAG: string;
};

export interface FrameTypesRecord { id: string; createdTime: string; fields: FrameTypesFields };
