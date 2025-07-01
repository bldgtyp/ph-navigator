export interface WindowUnitTypesFields {
    DISPLAY_NAME: string;
    'WIDTH [FT-IN]': string;
    'HEIGHT [FT-IN]': string;
    OPERATION: string;
    USE_TYPE: string;
    GLAZING_NAME: string;
    'FRAME ELEMENT NAME: LEFT': string;
    'FRAME ELEMENT NAME: RIGHT': string;
    'FRAME ELEMENT NAME: TOP': string;
    'FRAME ELEMENT NAME: BOTTOM': string;
}

export interface WindowUnitTypesRecord {
    id: string;
    createdTime: string;
    fields: WindowUnitTypesFields;
}
