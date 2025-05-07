import { CheckboxForDatasheet } from "../../../shared/components/CheckboxForDatasheet";
import { CheckboxForSpecification } from "../../../shared/components/CheckboxForSpecification";
import { LinkIconWithDefault } from "../../../shared/components/LinkIconWithDefault";
import { TooltipWithInfo } from "../../../shared/components/TooltipWithInfo";
import { TooltipWithComment } from "../../../shared/components/TooltipWithComment";
import { TooltipHeader } from "../../../shared/components/TooltipHeader";
import { ValueAsDecimal } from "../../../../../../formatters/ValueAsDecimal";


// ----------------------------------------------------------------------------
// Define the rows and columns
const tableFields = [
  {
    field: "DISPLAY_NAME",
    headerName: "Material",
    renderCell: (params: any) => TooltipWithInfo(params),
  },
  {
    field: "NOTES",
    headerName: "Notes",
    renderCell: (params: any) => TooltipWithComment(params),
  },

  {
    field: "SPECIFICATION",
    headerName: "specification",
    renderCell: (params: any) => CheckboxForSpecification(params),
    renderHeader: (params: any) =>
      TooltipHeader({ params, title: "Do we have a PDF data-sheet with the product's performance values? Yes/No" }),
  },
  {
    field: "DATA_SHEET",
    headerName: "Data Sheet",
    renderCell: (params: any) => CheckboxForDatasheet(params),
    renderHeader: (params: any) =>
      TooltipHeader({ params, title: "Do we have a PDF data-sheet with the product's performance values? Yes/No" }),
  },
  {
    field: "MATERIAL RESISTIVITY [HR-FT2-F / BTU-IN]",
    headerName: "R/Inch Value",
    renderHeader: (params: any) => TooltipHeader({ params, title: "Do we have a product specification? Yes/No" }),
    renderCell: (params: any) => {
      return ValueAsDecimal(params, 2);
    },
  },
  {
    field: "LINK",
    headerName: "Link",
    renderCell: (params: any) => LinkIconWithDefault(params),
  },
];

export default tableFields;