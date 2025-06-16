import { Tooltip } from '@mui/material';

type propsType = {
    params: { colDef: { headerName: string; [key: string]: any }; [key: string]: any };
    title: string;
};

/**
 * Renders a hover-over tooltip Header for a DataGrid:
 * @param params - The parameters for the tooltip header.
 * @param params.colDef.headerName - The header name for the tooltip.
 * @param title - The title of the tooltip header.
 * @returns The rendered tooltip header component.
 */
export const TooltipHeader: React.FC<propsType> = ({ params, title }) => (
    <Tooltip title={title}>
        <span>{params.colDef.headerName}</span>
    </Tooltip>
);
