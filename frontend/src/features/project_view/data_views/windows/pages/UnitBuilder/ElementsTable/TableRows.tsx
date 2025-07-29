import { useFrameTypes } from './FrameType.Context';

import { TableCell } from './TableCells';
import { FrameSelector } from './FrameTypeSelector';
import { GlazingRowProps, FrameRowProps } from './types';

export const GlazingRow: React.FC<GlazingRowProps> = ({ name, glazing, rowIndex }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>{name}:</span>
            </TableCell>
            <TableCell size={5} className={rowClass}>
                <span>{glazing?.name || '-'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{glazing?.u_value_w_m2k || '-'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>-</span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>{glazing?.g_value || '-'}</span>
            </TableCell>
        </>
    );
};

export const FrameRow: React.FC<FrameRowProps> = ({ aperture, element, rowIndex, position }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    const { isLoadingFrameTypes } = useFrameTypes();

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>{`${position} Frame:`}</span>
            </TableCell>
            <TableCell size={5} className={rowClass}>
                <FrameSelector
                    aperture={aperture}
                    element={element}
                    selectedFrame={element.frames[position]}
                    isLoading={isLoadingFrameTypes}
                    position={position}
                />
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{element.frames[position]?.u_value_w_m2k || '-'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{element.frames[position]?.width_mm || '-'}</span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>-</span>
            </TableCell>
        </>
    );
};
