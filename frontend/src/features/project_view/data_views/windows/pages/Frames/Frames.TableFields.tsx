import { CheckboxForDatasheet } from '../../../_components/CheckboxForDatasheet';
import { CheckboxForSpecification } from '../../../_components/CheckboxForSpecification';
import { LinkIconWithDefault } from '../../../_components/LinkIconWithDefault';
import { TooltipWithInfo } from '../../../_components/TooltipWithInfo';
import { TooltipWithComment } from '../../../_components/TooltipWithComment';
import { TooltipHeader } from '../../../_components/TooltipHeader';
import { ValueAsDecimal } from '../../../../../../formatters/ValueAsDecimal';

// --------------------------------------------------------------------------
// Define the rows and columns
const tableFields = [
    {
        field: 'DISPLAY_NAME',
        headerName: 'ID',
        renderCell: (params: any) => TooltipWithInfo(params),
    },
    {
        field: 'NOTES',
        headerName: 'Notes',
        renderCell: (params: any) => TooltipWithComment(params),
    },
    {
        field: 'SPECIFICATION',
        headerName: 'Specification',
        renderCell: (params: any) => CheckboxForSpecification(params),
        renderHeader: (params: any) => TooltipHeader({ params, title: 'Do we have a product specification? Yes/No' }),
    },
    {
        field: 'DATA_SHEET',
        headerName: 'Data Sheet',
        renderCell: (params: any) => CheckboxForDatasheet(params),
        renderHeader: (params: any) =>
            TooltipHeader({
                params,
                title: "Do we have a PDF data-sheet with the product's performance values? Yes/No",
            }),
    },
    { field: 'MANUFACTURER', headerName: 'Manuf.' },
    { field: 'MODEL', headerName: 'Model' },
    { field: 'OPERATION', headerName: 'Operation' },
    { field: 'LOCATION', headerName: 'Location' },
    {
        field: 'U-VALUE [BTU/HR-FT2-F]',
        headerName: 'U-Value',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 3);
        },
    },
    {
        field: 'WIDTH [IN]',
        headerName: 'Width [in.]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 2);
        },
    },
    {
        field: 'PSI-GLAZING [BTU/HR-FT-F]',
        headerName: 'Psi-G',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 3);
        },
    },
    {
        field: 'LINK',
        headerName: 'Link',
        renderCell: (params: any) => LinkIconWithDefault(params),
    },
];

export default tableFields;
