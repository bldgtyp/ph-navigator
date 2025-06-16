import { AirTableTableType } from '../../types/AirTableTableType';

export interface projectSettingsDataType {
    id: number;
    name: string;
    bt_number: string;
    phius_number: string | null;
    phius_dropbox_url: string | null;
    owner_id: number;
    airtable_base_id: string | null;
    airtable_base_url: string | null;
}

export const defaultProjectSettingsData = {
    id: 0,
    name: '',
    bt_number: '',
    phius_number: null,
    phius_dropbox_url: null,
    owner_id: 0,
    airtable_base_id: null,
    airtable_base_url: null,
};

export interface AirTableListItemPropsType {
    key: number;
    table: AirTableTableType;
    onChange: (e: any) => void;
}
