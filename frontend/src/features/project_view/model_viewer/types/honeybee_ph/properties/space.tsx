export type hbPhSpaceEnergyProperties = {
    id_num: number;
    type: string;
};

export type hbPhSpacePhProperties = {
    id_num: number;
    type: string;
    _v_eta: number | null;
    _v_sup: number | null;
    _v_tran: number | null;
};

export type hbPhSpaceProperties = {
    energy: any;
    ph: hbPhSpacePhProperties;
};
