export interface GlazingTypesFields {
    name: string;
    manufacturer: string;
    brand: string;
    g_value: number;
    u_value_w_m2k: number;
    link: string;
    datasheet_url: string;
    comments: string;
}

export interface GlazingTypesRecord {
    id: string;
    createdTime: string;
    fields: GlazingTypesFields;
}
