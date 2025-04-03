import { hbPhHvacPipeTrunk } from "./hot_water_piping";
import { hbPhHvacPipeElement } from "./hot_water_piping";

export type hbPhHvacHotWaterSystem = {
    distribution_piping: { [key: string]: hbPhHvacPipeTrunk };
    recirc_piping: { [key: string]: hbPhHvacPipeElement };
};