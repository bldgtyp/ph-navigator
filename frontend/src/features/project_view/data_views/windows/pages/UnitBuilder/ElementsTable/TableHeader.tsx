import { TableHeaderCell } from './TableCells';

export const TableHeader: React.FC = () => {
    return (
        <>
            <TableHeaderCell size={2}>
                <span>Element</span>
            </TableHeaderCell>
            <TableHeaderCell size={5}>
                <span>Name</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span>U-Value</span>
            </TableHeaderCell>
            <TableHeaderCell size={2}>
                <span>Width</span>
            </TableHeaderCell>
            <TableHeaderCell size={1}>
                <span>g-Value</span>
            </TableHeaderCell>
        </>
    );
};
