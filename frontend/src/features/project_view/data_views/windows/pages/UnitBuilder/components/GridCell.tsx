import React from 'react';
import { Box } from '@mui/material';
import { GridCellData } from './types';
import Sash from './Sash';

interface GridCellProps {
    cell: GridCellData;
    width: number;
    height: number;
}

const GridCell: React.FC<GridCellProps> = ({ cell, width, height }) => {
    return (
        <Box
            className="window-cell"
            sx={{
                gridRowStart: cell.row + 1,
                gridRowEnd: cell.row + 1 + cell.rowSpan,
                gridColumnStart: cell.col + 1,
                gridColumnEnd: cell.col + 1 + cell.colSpan,
                position: 'relative',
            }}
        >
            {cell.sash && <Sash height={height} width={width} />}
        </Box>
    );
};

export default GridCell;
