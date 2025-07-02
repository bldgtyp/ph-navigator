import React from 'react';
import { Box } from '@mui/material';
import Sash from './Sash';
import { GridCellProps } from './types';

const GridCell: React.FC<GridCellProps> = ({ cell, width, height, isSelected, onToggleSelect }) => {
    return (
        <Box
            className={`window-cell ${isSelected ? 'selected' : ''}`}
            onClick={() => onToggleSelect(cell.id)}
            sx={{
                gridRowStart: cell.row + 1,
                gridRowEnd: cell.row + 1 + cell.rowSpan,
                gridColumnStart: cell.col + 1,
                gridColumnEnd: cell.col + 1 + cell.colSpan,
                position: 'relative',
                cursor: 'pointer',
                border: isSelected ? '2px solid #1976d2' : '1px solid #ddd',
                backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                    backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.2)' : 'rgba(0, 0, 0, 0.04)',
                },
            }}
        >
            {cell.sash && <Sash height={height} width={width} />}
        </Box>
    );
};

export default GridCell;
