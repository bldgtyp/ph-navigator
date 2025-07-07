import React from 'react';
import { TableCell } from './TableCells';
import { GlazingRowProps, FrameRowProps } from './types';

export const GlazingRow: React.FC<GlazingRowProps & { rowIndex: number }> = ({ name, glazing, rowIndex }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>{name}:</span>
            </TableCell>
            <TableCell size={5} className={rowClass}>
                <span>{glazing?.name || '–'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{glazing?.u_value_w_m2k || '–'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>–</span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>{glazing?.g_value || '–'}</span>
            </TableCell>
        </>
    );
};

export const FrameRow: React.FC<FrameRowProps & { rowIndex: number }> = ({ name, frame, rowIndex }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>{name}:</span>
            </TableCell>
            <TableCell size={5} className={rowClass}>
                <span>{frame?.name || '–'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{frame?.u_value_w_m2k || '–'}</span>
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>{frame?.width_mm || '–'}</span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>–</span>
            </TableCell>
        </>
    );
};
