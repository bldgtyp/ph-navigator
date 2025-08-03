import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { TableHeaderCell } from './TableCells';

export const TableHeader: React.FC = () => {
    const { unitSystem } = useUnitConversion();

    return (
        <>
            <TableHeaderCell size={2}>
                <span style={{ whiteSpace: 'pre-line' }}>Element{'\n'}&nbsp;</span>
            </TableHeaderCell>
            <TableHeaderCell size={5}>
                <span style={{ whiteSpace: 'pre-line' }}>Name{'\n'}&nbsp;</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span
                    style={{ whiteSpace: 'pre-line' }}
                >{`U-Value\n${unitSystem === 'SI' ? '[W/mk]' : '[Btu/hr-ft2-F]'}`}</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span style={{ whiteSpace: 'pre-line' }}>{`Width\n${unitSystem === 'SI' ? '[mm]' : '[in]'}`}</span>
            </TableHeaderCell>
            <TableHeaderCell size={1}>
                <span style={{ whiteSpace: 'pre-line' }}>g-Value{'\n'}&nbsp;</span>
            </TableHeaderCell>
        </>
    );
};
