import { useState, useEffect } from "react";
import { datasheetRequired } from "../../data_views/shared/components/CheckboxForDatasheet";
import { fetchWithAlert } from "../../../../api/fetchData";


/**
 * Custom hook to load data grid rows from an AirTable API endpoint.
 *
 * @template T - The type of the fields in the AirTable record.
 * @param {Array<any>} defaultRow - The default row data to use when no data is fetched.
 * @param {string} page - The page identifier for the AirTable API endpoint.
 * @param {string} [projectId] - The optional project ID used to fetch data from the AirTable API.
 * @returns {{ showModal: boolean; rowData: any[] }} - An object containing:
 *   - `showModal`: A boolean indicating whether a loading modal should be displayed.
 *   - `rowData`: An array of row data fetched from the AirTable API or the default row data.
 *
 * @description
 * This hook fetches data from an AirTable API endpoint based on the provided `projectId` and `page`.
 * It sets a loading modal (`showModal`) to true while fetching data and hides it once the data is loaded.
 * If no data is fetched, the `defaultRow` is used as the row data.
 *
 * @example
 * const { showModal, rowData } = useLoadDataGridFromAirTable<MyFieldsType>([], "myPage", "12345");
 */
function useLoadDataGridFromAirTable<T>(
  defaultRow: Array<any>,
  page: string,
  projectId?: string
): { showModal: boolean; rowData: any[] } {
  type AirTableRecord = {
    id: string;
    createdTime: string;
    fields: T;
  };

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
      const records: AirTableRecord[] | null = await fetchWithAlert<AirTableRecord[] | null>(`air_table/${projectId}/${page}`);

      // Use the AirTable record data as the row-data
      // Add the record ID as the row-ID
      const newRows: Record<string, any>[] = records ? records.map((item) => {
        item = datasheetRequired(item);
        return { id: item.id, ...item.fields };
      }) : [];

      newRows.length > 0 ? setRowData(newRows) : setRowData(defaultRow);

      // Cancel the Model timer when the loading is done.
      clearTimeout(timerId);
      setShowModal(false);
    };

    fetchProjectData();
  }, [projectId, defaultRow, page]);

  return { showModal, rowData };
}

export default useLoadDataGridFromAirTable;
