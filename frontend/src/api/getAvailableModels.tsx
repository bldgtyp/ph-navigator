import { getWithAlert } from './getWithAlert';
import { HBModelMetadata } from '../features/project_view/model_viewer/types/model_metadata';

/**
 * Fetches the list of available HBJSON models for a project.
 * @param projectId - The ID of the project.
 * @returns An array of model metadata (record_id, date) sorted by date (newest first),
 * or null if there was an error during the fetch.
 */
export async function getAvailableModels(projectId: string): Promise<HBModelMetadata[] | null> {
    return await getWithAlert<HBModelMetadata[]>(`hb_model/${projectId}/models`);
}
