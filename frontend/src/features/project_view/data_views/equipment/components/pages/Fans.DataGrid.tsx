import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import StyledDataGrid from "../../../_styles/DataGrid";
import { generateGridColumns, generateDefaultRow } from "../../../_components/DataGridFunctions";
import ContentBlockHeader from "../../../_components/ContentBlockHeader";
import LoadingModal from "../../../_components/LoadingModal";
import useLoadDataGridFromAirTable from "../../../../model_viewer/_hooks/useLoadDataGridFromAirTable";
import { FanRecord } from "../../types/Fans";
import tableFields from "./Fans.TableFields";


// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// ----------------------------------------------------------------------------
const FanDataGrid: React.FC = () => {
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { showModal, rowData } = useLoadDataGridFromAirTable<FanRecord>(defaultRow, "fans", projectId);

  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={showModal} />
      <ContentBlockHeader text="Fans" />
      <Box>
        <StyledDataGrid
          rows={rowData}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 100]}
          checkboxSelection
        />
      </Box>
    </>
  );
}

export default FanDataGrid;
