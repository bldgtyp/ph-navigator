import { TooltipWithInfo } from '../../../_components/TooltipWithInfo';
import { TooltipWithComment } from '../../../_components/TooltipWithComment';
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
        field: 'WIDTH [FT-IN]',
        headerName: 'Width',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 2);
        },
    },
    {
        field: 'HEIGHT [FT-IN]',
        headerName: 'Height',
        renderCell: (params: any) => {
            return ValueAsDecimal(params, 2);
        },
    },
    { field: 'OPERATION', headerName: 'Operation' },
    { field: 'USE_TYPE', headerName: 'Use Type' },
    { field: 'GLAZING_NAME', headerName: 'Glazing' },
    { field: 'FRAME ELEMENT NAME: LEFT', headerName: 'Frame: Left' },
    { field: 'FRAME ELEMENT NAME: RIGHT', headerName: 'Frame: Right' },
    { field: 'FRAME ELEMENT NAME: TOP', headerName: 'Frame: Top' },
    { field: 'FRAME ELEMENT NAME: BOTTOM', headerName: 'Frame: Bottom' },
];

export default tableFields;
