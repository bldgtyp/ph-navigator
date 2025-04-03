import { hbEnergyApertureFaceEnergyProperties } from "../honeybee_energy/properties/aperture";
import { hbEnergyFaceEnergyProperties } from "../honeybee_energy/properties/face";

export type hbFaceProperties = {
    energy: hbEnergyFaceEnergyProperties;
};

export type hbApertureProperties = {
    energy: hbEnergyApertureFaceEnergyProperties;
};
