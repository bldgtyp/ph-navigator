import { useParams } from "react-router-dom";
import { Box, Stack } from "@mui/material";
import StyledDataGrid from "../../../styles/DataGrid";
import { generateGridColumns, generateDefaultRow } from "../../../shared/components/DataGridFunctions";
import { CheckboxForDatasheet } from "../../../shared/components/CheckboxForDatasheet";
import { CheckboxForSpecification } from "../../../shared/components/CheckboxForSpecification";
import { LinkIconWithDefault } from "../../../shared/components/LinkIconWithDefault";
import { TooltipWithInfo } from "../../../shared/components/TooltipWithInfo";
import { TooltipWithComment } from "../../../shared/components/TooltipWithComment";
import { TooltipHeader } from "../../../shared/components/TooltipHeader";
import LoadingModal from "../../../shared/components/LoadingModal";
import useLoadDataGridFromAirTable from "../../../../model_viewer/hooks/useLoadDataGridFromAirTable";
import React from "react";

// ----------------------------------------------------------------------------
// Define the AirTable data types
type AppliancesFields = {
  DISPLAY_NAME: string;
  ZONE: string;
  DESCRIPTION: string;
  MANUFACTURER: string;
  MODEL: string;
  ENERGY_STAR: string;
  LINK: string;
  SPECIFICATION: boolean;
  DATA_SHEET: string;
  NOTES: string;
  FLAG: string;
};

type AppliancesRecord = { id: string; createdTime: string; fields: AppliancesFields };

// --------------------------------------------------------------------------
// Define the rows and columns
const tableFields = [
  {
    field: "DISPLAY_NAME",
    headerName: "ID",
    flex: 1,
    renderCell: (params: any) => TooltipWithInfo(params),
  },
  {
    field: "NOTES",
    headerName: "Notes",
    flex: 0.5,
    renderCell: (params: any) => TooltipWithComment(params),
  },
  {
    field: "SPECIFICATION",
    headerName: "Specification",
    flex: 1,
    renderCell: (params: any) => CheckboxForSpecification(params),
    renderHeader: (params: any) => TooltipHeader({ params, title: "Do we have a product specification? Yes/No" }),
  },
  {
    field: "DATA_SHEET",
    headerName: "Data Sheet",
    flex: 1,
    renderCell: (params: any) => CheckboxForDatasheet(params),
    renderHeader: (params: any) =>
      TooltipHeader({ params, title: "Do we have a PDF data-sheet with the product's performance values? Yes/No" }),
  },
  { field: "DESCRIPTION", headerName: "Type", flex: 1 },
  { field: "MANUFACTURER", headerName: "Manuf.", flex: 1 },
  { field: "MODEL", headerName: "Model", flex: 1 },
  { field: "ZONE", headerName: "Zone", flex: 1 },
  { field: "ENERGY_STAR", headerName: "EnergyStar", flex: 1 },
  {
    field: "LINK",
    headerName: "Link",
    flex: 1,
    renderCell: (params: any) => LinkIconWithDefault(params),
  },
];

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// ----------------------------------------------------------------------------
const AppliancesDataGrid: React.FC = () => {
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { showModal, rowData } = useLoadDataGridFromAirTable<AppliancesRecord>(defaultRow, "appliances", projectId);

  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={showModal} />
      <Stack className="content-block-heading" spacing={1}>
        <h3>Electrical Appliances:</h3>
      </Stack>
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

export default AppliancesDataGrid;
