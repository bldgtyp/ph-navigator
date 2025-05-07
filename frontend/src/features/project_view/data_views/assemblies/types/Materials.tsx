// ----------------------------------------------------------------------------
// Define the AirTable data types
type MaterialsFields = {
    DISPLAY_NAME: string;
    LAYER_MATERIAL_NAME: string;
    "MATERIAL RESISTIVITY [HR-FT2-F / BTU-IN]": number;
    LINK: string;
    SPECIFICATION: string;
    DATA_SHEET?: [{ url: string; required: boolean }];
    NOTES: string;
    FLAG: string;
};

type MaterialsRecord = { id: string; createdTime: string; fields: MaterialsFields };

export type { MaterialsRecord }