import { getWithAlert } from '../../../../../../../../api/getWithAlert';
import { patchWithAlert } from '../../../../../../../../api/patchWithAlert';
import { deleteWithAlert } from '../../../../../../../../api/deleteWithAlert';
import { postWithAlert } from '../../../../../../../../api/postWithAlert';
import { ApertureType } from '../../types';
import { FramePosition } from '../../ElementsTable/types';

/**
 * Service layer for aperture-related API calls
 * Separates API concerns from state management
 */
export class ApertureService {
    // Fetch Operations
    static async fetchAperturesByProject(projectId: string): Promise<ApertureType[]> {
        try {
            const apertures = await getWithAlert<ApertureType[]>(`aperture/get-apertures/${projectId}`);
            return apertures ?? [];
        } catch (error) {
            console.error('Error fetching apertures:', error);
            throw new Error(`Failed to fetch apertures: ${error}`);
        }
    }

    // Aperture CRUD Operations
    static async createAperture(projectId: string): Promise<ApertureType> {
        try {
            const newAperture = await postWithAlert<ApertureType>(
                `aperture/create-new-aperture-on-project/${projectId}`
            );
            if (!newAperture) {
                throw new Error('Failed to create aperture - no response received');
            }
            return newAperture;
        } catch (error) {
            console.error('Error creating aperture:', error);
            throw new Error(`Failed to create aperture: ${error}`);
        }
    }

    static async deleteAperture(apertureId: number): Promise<void> {
        try {
            await deleteWithAlert(`aperture/delete-aperture/${apertureId}`, null, {});
        } catch (error) {
            console.error('Error deleting aperture:', error);
            throw new Error(`Failed to delete aperture: ${error}`);
        }
    }

    static async updateApertureName(apertureId: number, newName: string): Promise<void> {
        try {
            await patchWithAlert(`aperture/update-aperture-name/${apertureId}`, null, {
                new_name: newName,
            });
        } catch (error) {
            console.error('Error updating aperture name:', error);
            throw new Error(`Failed to update aperture name: ${error}`);
        }
    }

    // Grid Operations
    static async addRow(apertureId: number): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(`aperture/add-row/${apertureId}`);
            if (!updatedAperture) {
                throw new Error('Failed to add row - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error adding row:', error);
            throw new Error(`Failed to add row: ${error}`);
        }
    }

    static async deleteRow(apertureId: number, rowNumber: number): Promise<ApertureType> {
        try {
            const updatedAperture = await deleteWithAlert<ApertureType>(`aperture/delete-row/${apertureId}`, null, {
                row_number: rowNumber,
            });
            if (!updatedAperture) {
                throw new Error('Failed to delete row - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error deleting row:', error);
            throw new Error(`Failed to delete row: ${error}`);
        }
    }

    static async addColumn(apertureId: number): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(`aperture/add-column/${apertureId}`);
            if (!updatedAperture) {
                throw new Error('Failed to add column - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error adding column:', error);
            throw new Error(`Failed to add column: ${error}`);
        }
    }

    static async deleteColumn(apertureId: number, colNumber: number): Promise<ApertureType> {
        try {
            const updatedAperture = await deleteWithAlert<ApertureType>(`aperture/delete-column/${apertureId}`, null, {
                column_number: colNumber,
            });
            if (!updatedAperture) {
                throw new Error('Failed to delete column - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error deleting column:', error);
            throw new Error(`Failed to delete column: ${error}`);
        }
    }

    // Sizing Operations
    static async updateColumnWidth(apertureId: number, columnIndex: number, newWidthMM: number): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(
                `aperture/update-column-width/${apertureId}`,
                null,
                {
                    column_index: columnIndex,
                    new_width_mm: newWidthMM,
                }
            );
            if (!updatedAperture) {
                throw new Error('Failed to update column width - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error updating column width:', error);
            throw new Error(`Failed to update column width: ${error}`);
        }
    }

    static async updateRowHeight(apertureId: number, rowIndex: number, newHeightMM: number): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(
                `aperture/update-row-height/${apertureId}`,
                null,
                {
                    row_index: rowIndex,
                    new_height_mm: newHeightMM,
                }
            );
            if (!updatedAperture) {
                throw new Error('Failed to update row height - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error updating row height:', error);
            throw new Error(`Failed to update row height: ${error}`);
        }
    }

    // Frame Operations
    static async updateElementFrame(params: {
        apertureId: number;
        elementId: number;
        framePosition: FramePosition;
        frameId: number | null;
    }): Promise<ApertureType> {
        if (!params.frameId) {
            throw new Error('Frame ID is required');
        }

        try {
            const response = await patchWithAlert<ApertureType>(`aperture/update-frame/${params.apertureId}`, null, {
                element_id: params.elementId,
                side: params.framePosition,
                frame_id: params.frameId,
            });
            if (!response) {
                throw new Error('Failed to update aperture element frame - no response received');
            }
            return response;
        } catch (error) {
            console.error('Error updating aperture element frame:', error);
            throw new Error(`Failed to update aperture element frame: ${error}`);
        }
    }

    // Element Operations
    static async mergeElements(apertureId: number, elementIds: number[]): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(
                `aperture/merge-aperture-elements/${apertureId}`,
                null,
                {
                    aperture_element_ids: elementIds,
                }
            );
            if (!updatedAperture) {
                throw new Error('Failed to merge elements - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error merging elements:', error);
            throw new Error(`Failed to merge elements: ${error}`);
        }
    }

    static async splitElement(apertureId: number, elementId: number): Promise<ApertureType> {
        try {
            const updatedAperture = await patchWithAlert<ApertureType>(
                `aperture/split-aperture-element/${apertureId}`,
                null,
                { aperture_element_id: elementId }
            );
            if (!updatedAperture) {
                throw new Error('Failed to split element - no response received');
            }
            return updatedAperture;
        } catch (error) {
            console.error('Error splitting element:', error);
            throw new Error(`Failed to split element: ${error}`);
        }
    }
}
