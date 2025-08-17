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
    { field: 'use', headerName: 'Use' },
    { field: 'operation', headerName: 'Operation' },
    { field: 'location', headerName: 'Location' },
    {
        field: 'u_value_w_m2k',
        headerName: 'U-Value [W/m2k]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 3);
        },
    },
    {
        field: 'width_mm',
        headerName: 'Width [mm]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 1);
        },
    },
    {
        field: 'psi_g_w_mk',
        headerName: 'Psi-G [W/mk]',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 3);
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
