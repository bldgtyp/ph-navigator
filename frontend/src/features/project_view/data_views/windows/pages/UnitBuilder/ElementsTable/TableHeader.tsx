import { Tooltip } from '@mui/material';
import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { TableHeaderCell } from './TableCells';

export const TableHeader: React.FC = () => {
    const { unitSystem } = useUnitConversion();
    const uValueUnit = unitSystem === 'SI' ? 'W/m²K' : 'Btu/hr·ft²·F';
    const widthUnit = unitSystem === 'SI' ? 'mm' : 'in';

    return (
        <>
            <TableHeaderCell size={2}>
                <span>Element</span>
            </TableHeaderCell>
            <TableHeaderCell size={6}>
                <span>Name</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <Tooltip title={`U-Value [${uValueUnit}]`} arrow placement="top">
                    <span style={{ cursor: 'help' }}>U-Value</span>
                </Tooltip>
            </TableHeaderCell>
            <TableHeaderCell size={1}>
                <Tooltip title={`Width [${widthUnit}]`} arrow placement="top">
                    <span style={{ cursor: 'help' }}>Width</span>
                </Tooltip>
            </TableHeaderCell>
            <TableHeaderCell size={1}>
                <Tooltip title="Solar Heat Gain Coefficient" arrow placement="top">
                    <span style={{ cursor: 'help' }}>g-Value</span>
                </Tooltip>
            </TableHeaderCell>
        </>
    );
};
