import React from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import StyledDataGrid from "../../../styles/DataGrid";
import { generateGridColumns, generateDefaultRow } from "../../../shared/components/DataGridFunctions";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import LoadingModal from "../../../shared/components/LoadingModal";
import useLoadDataGridFromAirTable from "../../../../model_viewer/hooks/useLoadDataGridFromAirTable";
import { useDynamicColumns } from "../../../shared/hooks/useDynamicColumns";
import tableFields from "./Glazing.TableFields";
import { GlazingTypesRecord } from "../../types/Glazing";

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

const GlazingTypesDataGrid: React.FC = () => {
  // --------------------------------------------------------------------------
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { showModal, rowData } = useLoadDataGridFromAirTable<GlazingTypesRecord>(
    defaultRow,
    "glazing_types",
    projectId
  );

  // --------------------------------------------------------------------------
  // Update columns dynamically when rowData changes
  const adjustedColumns = useDynamicColumns(columns, rowData, ["DISPLAY_NAME"]);

  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={showModal} />
      <ContentBlockHeader text="Window & Door Glazing Types" />
      <Box sx={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
        <StyledDataGrid
          rows={rowData}
          columns={adjustedColumns}
        />
      </Box>
    </>
  );
}

export default GlazingTypesDataGrid;
