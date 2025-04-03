import { hbPhHvacDuctElement } from './ducting';

export type hbPhHvacVentilationSystem = {
    supply_ducting: hbPhHvacDuctElement[];
    exhaust_ducting: hbPhHvacDuctElement[];
};