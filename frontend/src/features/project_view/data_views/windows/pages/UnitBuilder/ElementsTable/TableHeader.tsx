import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { TableHeaderCell } from './TableCells';

export const TableHeader: React.FC = () => {
    const { unitSystem } = useUnitConversion();

    return (
        <>
            <TableHeaderCell size={2}>
                <span>Element</span>
            </TableHeaderCell>
            <TableHeaderCell size={5}>
                <span>Name</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span>{`U-Value\n${unitSystem === 'SI' ? '[W/mk]' : '[Btu/hr-ft2-F]'}`}</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span>{`Width\n${unitSystem === 'SI' ? '[mm]' : '[in]'}`}</span>
            </TableHeaderCell>
            <TableHeaderCell size={1}>
                <span>g-Value</span>
            </TableHeaderCell>
        </>
    );
};
