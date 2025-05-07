import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import StyledDataGrid from "../../../styles/DataGrid";
import { generateGridColumns, generateDefaultRow } from "../../../shared/components/DataGridFunctions";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import LoadingModal from "../../../shared/components/LoadingModal";
import useLoadDataGridFromAirTable from "../../../../model_viewer/hooks/useLoadDataGridFromAirTable";
import { DHWTankRecord } from "../../types/HotWaterTanks";
import tableFields from "./HotWaterTanks.TableFields";


// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// ----------------------------------------------------------------------------
const HotWaterTanksDataGrid: React.FC = () => {
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { showModal, rowData } = useLoadDataGridFromAirTable<DHWTankRecord>(defaultRow, "dhw_tanks", projectId);

  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={showModal} />
      <ContentBlockHeader text="Hot Water Tanks" />
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

export default HotWaterTanksDataGrid;
