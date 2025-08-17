import { CheckboxForDatasheet } from '../../../_components/CheckboxForDatasheet';
import { LinkIconWithDefault } from '../../../_components/LinkIconWithDefault';
import { TooltipWithComment } from '../../../_components/TooltipWithComment';
import { TooltipHeader } from '../../../_components/TooltipHeader';
import { ValueAsDecimal } from '../../../../../../formatters/ValueAsDecimal';

// --------------------------------------------------------------------------
// Define the rows and columns
const tableFields = [
    { field: 'manufacturer', headerName: 'Manuf' },
    { field: 'brand', headerName: 'Brand' },
    {
        field: 'u_value_w_m2k',
        headerName: 'U-Value [W/M2K]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 2);
        },
    },
    {
        field: 'g_value',
        headerName: 'g-Value [%]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 2);
        },
    },
    {
        field: 'datasheet_url',
        headerName: 'Data Sheet',
        renderCell: (params: any) =>
            CheckboxForDatasheet({ value: [{ id: params.row.id, url: params.row.datasheet_url, required: true }] }),
        renderHeader: (params: any) =>
            TooltipHeader({
                params,
                title: "Do we have a PDF data-sheet with the product's performance values? Yes/No",
            }),
    },
    {
        field: 'comments',
        headerName: 'Notes',
        renderCell: (params: any) => TooltipWithComment({ row: { NOTES: params.row.comments } }),
    },
    {
        field: 'link',
        headerName: 'Link',
        renderCell: (params: any) => LinkIconWithDefault({ value: params.row.link }),
    },
];

export default tableFields;
