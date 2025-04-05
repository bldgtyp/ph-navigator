export type ProjectType = {
    name: string,
    id: string,
    bt_number: string,
    phius_number: string,
    airtable_base: string,
    owner_id: string,
    user_ids: string,
    airtable_base_ref: string,
    airtable_base_url: string,
    phius_dropbox_url: string,
}

export const defaultProjectType = {
    name: "",
    id: "",
    bt_number: "",
    phius_number: "",
    airtable_base: "",
    owner_id: "",
    user_ids: "",
    airtable_base_ref: "",
    airtable_base_url: "",
    phius_dropbox_url: "",
}