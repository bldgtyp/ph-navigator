import { hbEnergyOpaqueMaterial } from "../material/opaque";

export type hbEnergyOpaqueConstruction = {
    identifier: string;
    type: string;
    r_factor: number;
    u_factor: number;
    materials: hbEnergyOpaqueMaterial[];
};
