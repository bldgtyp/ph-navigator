import { CheckboxForDatasheet } from "../../../shared/components/CheckboxForDatasheet";
import { CheckboxForSpecification } from "../../../shared/components/CheckboxForSpecification";
import { LinkIconWithDefault } from "../../../shared/components/LinkIconWithDefault";
import { TooltipWithInfo } from "../../../shared/components/TooltipWithInfo";
import { TooltipWithComment } from "../../../shared/components/TooltipWithComment";
import { TooltipHeader } from "../../../shared/components/TooltipHeader";


// ----------------------------------------------------------------------------
// Define the table columns and rows to display
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
  { field: "WATTS", headerName: "Watts", flex: 1 },
  { field: "LUMENS", headerName: "Lumens", flex: 1 },
  { field: "ZONE", headerName: "Zone", flex: 1 },
  { field: "ENERGY_STAR", headerName: "EnergyStar", flex: 1 },
  {
    field: "LINK",
    headerName: "Link",
    flex: 1,
    renderCell: (params: any) => LinkIconWithDefault(params),
  },
];
export default tableFields;