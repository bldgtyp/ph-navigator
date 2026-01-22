import { getWithAlert } from './getWithAlert';
import { hbFace } from '../features/project_view/model_viewer/types/honeybee/face';
import { hbPhSpace } from '../features/project_view/model_viewer/types/honeybee_ph/space';
import { lbtSunPathAndCompass } from '../features/project_view/model_viewer/types/ladybug/sunpath';
import { hbPhHvacHotWaterSystem } from '../features/project_view/model_viewer/types/honeybee_phhvac/hot_water_system';
import { hbPhHvacVentilationSystem } from '../features/project_view/model_viewer/types/honeybee_phhvac/ventilation';
import { hbShadeGroup } from '../features/project_view/model_viewer/types/honeybee/shade';

/**
 * Combined response type from the model_data endpoint.
 */
interface CombinedModelData {
    faces: hbFace[];
    spaces: hbPhSpace[];
    sun_path: lbtSunPathAndCompass | null;
    hot_water_systems: hbPhHvacHotWaterSystem[];
    ventilation_systems: hbPhHvacVentilationSystem[];
    shading_elements: hbShadeGroup[];
}

/**
 * Fetches the 3D-Model data for a specified project.
 * Uses a single combined endpoint to reduce HTTP round trips from 6 to 1.
 * @param projectId - The ID of the project.
 * @param recordId - Optional AirTable record ID for a specific model version. If null, loads the latest model.
 * @param forceRefresh - If true, bypass cache and re-download from AirTable.
 * @returns An object containing the fetched model data, including faces, spaces, sun path data,
 * hot water system data, ventilation system data, and shading elements data.
 * Returns null if there was an error during the fetch.
 */
export async function get3DModelData(projectId: string, recordId: string | null = null, forceRefresh: boolean = false) {
    try {
        // Build params object with record_id and force_refresh if provided
        const params: Record<string, string> = {};
        if (recordId) params.record_id = recordId;
        if (forceRefresh) params.force_refresh = 'true';

        // Fetch all model data in a single request
        const combinedData = await getWithAlert<CombinedModelData>(`hb_model/${projectId}/model_data`, null, params);

        if (!combinedData) {
            return null;
        }

        // Map the combined response to the expected return format
        return {
            facesData: combinedData.faces,
            spacesData: combinedData.spaces,
            sunPathData: combinedData.sun_path,
            hotWaterSystemData: combinedData.hot_water_systems,
            ventilationSystemData: combinedData.ventilation_systems,
            shadingElementsData: combinedData.shading_elements,
        };
    } catch (error) {
        console.error(error);
        return null;
    }
}
