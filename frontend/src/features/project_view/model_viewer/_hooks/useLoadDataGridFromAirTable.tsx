import { useState, useEffect } from 'react';
import { datasheetRequired } from '../../data_views/_components/CheckboxForDatasheet';
import { getWithAlert } from '../../../../api/getWithAlert';

/**
 * Interface for the AirTable record structure
 */
interface AirTableRecord<T> {
    id: string;
    createdTime: string;
    fields: T;
}

/**
 * Interface for the hook return value
 */
interface LoadDataGridResult {
    showModal: boolean;
    rowData: Array<Record<string, any>>;
}

/**
 * Custom hook to load data grid rows from an AirTable API endpoint.
 *
 * @template T - The type of the fields in the AirTable record.
 * @param {Array<any>} defaultRow - The default row data to use when no data is fetched.
 * @param {string} page - The page identifier for the AirTable API endpoint.
 * @param {string} [projectId] - The optional project ID used to fetch data from the AirTable API.
 * @returns {LoadDataGridResult} - An object containing showModal and rowData
 */
function useLoadDataGridFromAirTable<T>(
    defaultRow: Array<Record<string, any>>,
    page: string,
    projectId?: string
): LoadDataGridResult {
    const [showModal, setShowModal] = useState(false);
    const [rowData, setRowData] = useState<Array<any>>(defaultRow);

    useEffect(() => {
        if (!projectId) {
            return;
        }

        // Start the Model Timer
        const timerId: NodeJS.Timeout = setTimeout(() => {
            setShowModal(true);
        }, 1000);

        const fetchProjectData = async () => {
            const records: AirTableRecord<T>[] | null = await getWithAlert<AirTableRecord<T>[] | null>(
                `air_table/${projectId}/${page}`
            );

            if (records && records.length > 0) {
                // Use the AirTable record data as the row-data
                // Add the record ID as the row-ID
                const newRows: Record<string, any>[] = records.map(item => {
                    item = datasheetRequired(item);
                    return { id: item.id, ...item.fields };
                });

                // Always sort the newRows Alphabetically by the 'DISPLAY_NAME' field, if it exists
                if (newRows[0]?.DISPLAY_NAME !== undefined) {
                    newRows.sort((a, b) => a.DISPLAY_NAME.localeCompare(b.DISPLAY_NAME));
                }

                setRowData(newRows);
            } else {
                setRowData(defaultRow);
            }
            // Cancel the Model timer when the loading is done.
            clearTimeout(timerId);
            setShowModal(false);
        };

        fetchProjectData();
    }, [projectId, defaultRow, page]);

    return { showModal, rowData };
}

export default useLoadDataGridFromAirTable;
