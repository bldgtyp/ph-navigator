import React from 'react';
import { TableCell } from './TableCells';
import { FrameSelector } from './FrameSelector';
import { GlazingRowProps, FrameRowProps } from './types';
import { ApertureElementFrameType } from '../../types';
import { useApertureElementFrames } from '../Aperture.Frame.Context';

export const GlazingRow: React.FC<GlazingRowProps & { rowIndex: number }> = ({ name, glazing, rowIndex }) => {
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

export const FrameRow: React.FC<
    FrameRowProps & {
        rowIndex: number;
        onFrameChange?: (frame: ApertureElementFrameType | null) => void;
    }
> = ({ name, frame, rowIndex, onFrameChange }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    const { frames, isLoading } = useApertureElementFrames();

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>{name}:</span>
            </TableCell>
            <TableCell size={5} className={rowClass}>
                <FrameSelector
                    selectedFrame={frame}
                    frameOptions={frames}
                    onFrameChange={onFrameChange || (() => {})}
                    isLoading={isLoading}
                    placeholder={`Select ${name.toLowerCase()}`}
                />
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
