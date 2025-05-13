import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import StyledDataGrid from "../../../shared/styles/DataGrid";
import { generateGridColumns, generateDefaultRow } from "../../../shared/components/DataGridFunctions";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import LoadingModal from "../../../shared/components/LoadingModal";
import useLoadDataGridFromAirTable from "../../../../model_viewer/hooks/useLoadDataGridFromAirTable";
import { useDynamicColumns } from "../../../shared/hooks/useDynamicColumns";
import tableFields from "./Frames.TableFields";
import { FrameTypesRecord } from "../../types/Frames";

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

const FrameTypesDataGrid: React.FC = () => {
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { showModal, rowData } = useLoadDataGridFromAirTable<FrameTypesRecord>(defaultRow, "WINDOW_FRAME_TYPES", projectId);

  // --------------------------------------------------------------------------
  // Update columns dynamically when rowData changes
  const adjustedColumns = useDynamicColumns(columns, rowData, ["DISPLAY_NAME", "OPERATION", "LOCATION"])

  // Set the column state to the adjusted columns
  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={showModal} />
      <ContentBlockHeader text="Window & Door Frames" />
      <Box>
        <StyledDataGrid
          rows={rowData}
          columns={adjustedColumns}
        />
      </Box>
    </>
  );
}

export default FrameTypesDataGrid;
