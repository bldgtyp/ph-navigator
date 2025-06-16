export interface MaterialLayersFields {
    DISPLAY_NAME: string;
    LAYER_MATERIAL_NAME: string;
    'MATERIAL RESISTIVITY [HR-FT2-F / BTU-IN]': number;
    LINK: string;
    SPECIFICATION: string;
    DATA_SHEET?: [{ url: string; required: boolean }];
    NOTES: string;
    FLAG: string;
}

export interface MaterialLayersRecord {
    id: string;
    createdTime: string;
    fields: MaterialLayersFields;
}
