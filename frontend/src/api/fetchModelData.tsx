import { fetchWithAlert } from "./fetchData";
import { hbFace } from "../features/project_view/model_viewer/types/honeybee/face";
import { hbPhSpace } from "../features/project_view/model_viewer/types/honeybee_ph/space";
import { lbtSunPathDTO } from "../features/project_view/model_viewer/types/ladybug/sunpath";
import { hbPhHvacHotWaterSystem } from "../features/project_view/model_viewer/types/honeybee_phhvac/hot_water_system";
import { hbPhHvacVentilationSystem } from "../features/project_view/model_viewer/types/honeybee_phhvac/ventilation";
import { hbShadeGroup } from "../features/project_view/model_viewer/types/honeybee/shade";

/**
 * Fetches the 3D-Model data for a specified project.
 * @param projectId - The ID of the project.
 * @returns An object containing the fetched model data, including faces, spaces, sun path data,
 * hot water system data, ventilation system data, and shading elements data.
 * Returns null if there was an error during the fetch.
 */
export async function fetchModelData(projectId: string) {
    try {
        console.log(`fetchModelData(projectId=${projectId})`)

        const routeLoadModel = `${projectId}/load_hb_model`;
        const modelData = await fetchWithAlert<hbFace[]>(routeLoadModel);
        if (!modelData) { return null }

        const routeFaces = `${projectId}/faces`;
        const facesData = await fetchWithAlert<hbFace[]>(routeFaces);

        const routeSpaces = `${projectId}/spaces`;
        const spacesData = await fetchWithAlert<hbPhSpace[]>(routeSpaces);

        const routeSunPath = `${projectId}/sun_path`;
        const sunPathData = await fetchWithAlert<lbtSunPathDTO[]>(routeSunPath);

        const routeHotWaterSystem = `${projectId}/hot_water_systems`;
        const hotWaterSystemData = await fetchWithAlert<hbPhHvacHotWaterSystem[]>(routeHotWaterSystem);

        const routeVentilationSystem = `${projectId}/ventilation_systems`;
        const ventilationSystemData = await fetchWithAlert<hbPhHvacVentilationSystem[]>(routeVentilationSystem);

        const routeShades = `${projectId}/shading_elements`;
        const shadingElementsData = await fetchWithAlert<hbShadeGroup[]>(routeShades);

        return { facesData, spacesData, sunPathData, hotWaterSystemData, ventilationSystemData, shadingElementsData };
    } catch (error) {
        console.error(error);
        return null;
    }
}
