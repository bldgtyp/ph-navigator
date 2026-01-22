import { getWithAlert } from './getWithAlert';
import { hbFace } from '../features/project_view/model_viewer/types/honeybee/face';
import { hbPhSpace } from '../features/project_view/model_viewer/types/honeybee_ph/space';
import { lbtSunPathAndCompass } from '../features/project_view/model_viewer/types/ladybug/sunpath';
import { hbPhHvacHotWaterSystem } from '../features/project_view/model_viewer/types/honeybee_phhvac/hot_water_system';
import { hbPhHvacVentilationSystem } from '../features/project_view/model_viewer/types/honeybee_phhvac/ventilation';
import { hbShadeGroup } from '../features/project_view/model_viewer/types/honeybee/shade';

/**
 * Fetches the 3D-Model data for a specified project.
 * @param projectId - The ID of the project.
 * @param recordId - Optional AirTable record ID for a specific model version. If null, loads the latest model.
 * @param forceRefresh - If true, bypass cache and re-download from AirTable.
 * @returns An object containing the fetched model data, including faces, spaces, sun path data,
 * hot water system data, ventilation system data, and shading elements data.
 * Returns null if there was an error during the fetch.
 */
export async function get3DModelData(projectId: string, recordId: string | null = null, forceRefresh: boolean = false) {
    try {
        // TODO: this should be done automatically on the server when any model data is accessed
        // const routeLoadModel = `${projectId}/load_hb_model`;
        // const modelData = await fetchWithAlert<hbFace[]>(routeLoadModel);
        // if (!modelData) { return null }

        // Build params object with record_id and force_refresh if provided
        const params: Record<string, string> = {};
        if (recordId) params.record_id = recordId;
        if (forceRefresh) params.force_refresh = 'true';

        // Fetch all model data in parallel for faster loading
        const [facesData, spacesData, sunPathData, hotWaterSystemData, ventilationSystemData, shadingElementsData] =
            await Promise.all([
                getWithAlert<hbFace[]>(`hb_model/${projectId}/faces`, null, params),
                getWithAlert<hbPhSpace[]>(`hb_model/${projectId}/spaces`, null, params),
                getWithAlert<lbtSunPathAndCompass[]>(`hb_model/${projectId}/sun_path`),
                getWithAlert<hbPhHvacHotWaterSystem[]>(`hb_model/${projectId}/hot_water_systems`, null, params),
                getWithAlert<hbPhHvacVentilationSystem[]>(`hb_model/${projectId}/ventilation_systems`, null, params),
                getWithAlert<hbShadeGroup[]>(`hb_model/${projectId}/shading_elements`, null, params),
            ]);

        return { facesData, spacesData, sunPathData, hotWaterSystemData, ventilationSystemData, shadingElementsData };
    } catch (error) {
        console.error(error);
        return null;
    }
}
