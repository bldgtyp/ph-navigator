export interface AirtightnessDataType {
    floor_area_m2: number;
    envelope_area_m2: number;
    net_volume_m3: number;
    n_50_ACH: number;
    q_50_m3_hr_m2: number;
    air_leakage_m3_hr: number;
}

export const defaultAirtightnessData: AirtightnessDataType = {
    floor_area_m2: 0,
    envelope_area_m2: 0,
    net_volume_m3: 0,
    n_50_ACH: 0,
    q_50_m3_hr_m2: 0,
    air_leakage_m3_hr: 0,
};
