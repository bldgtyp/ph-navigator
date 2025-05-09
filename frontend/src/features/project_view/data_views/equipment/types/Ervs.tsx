export interface ErvFields {
    "AIRFLOW [CFM]": number;
    "DEFROST MIN TEMP [°F]": number;
    DISPLAY_NAME: string;
    "DUCT_ETA_SIZE [IN]": string;
    "DUCT_SUP_SIZE [IN]": string;
    "ELECTRICAL EFFICIENCY [W/CFM]": number;
    "ELECTRICAL_EFFICIENCY [W/CFM]": number;
    "ENERGY RECOVERY [%]": number;
    "ERV: RISERS": Array<string>;
    "HAS SUMMER BYPASS?": string;
    "HAVE AHRI TESTING?": string;
    "HAVE SPEC?": "No";
    "HEAT RECOVERY [%]": number;
    "IN CONDITIONED SPACE?": string;
    MANUFACTURER: string;
    MODEL: string;
    "Name (from ERV: RISERS)": Array<string>;
    "ROOMS SERVED": Array<string>;
    "WATTAGE [W]": number;
    "WINTER DEFROST PROTECTION?": string;
    LINK: string;
    SPECIFICATION: boolean;
    DATA_SHEET: string;
    NOTES: string;
    FLAG: string;
};

export interface ErvRecord {
    id: string;
    createdTime: string;
    fields: ErvFields;
};