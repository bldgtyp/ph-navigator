import React from 'react';
import { Box } from '@mui/material';

import ApertureElementSVG from './ApertureElement.SVG';
import { GridCellProps } from '../types';

const ApertureElementContainer: React.FC<GridCellProps> = ({ element, width, height, isSelected, onToggleSelect }) => {
    return (
        <Box
            className={`window-cell ${isSelected ? 'selected' : ''}`}
            onClick={() => onToggleSelect(element.id)}
            sx={{
                gridRowStart: element.row_number + 1,
                gridRowEnd: element.row_number + 1 + element.row_span,
                gridColumnStart: element.column_number + 1,
                gridColumnEnd: element.column_number + 1 + element.col_span,
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
            <ApertureElementSVG height={height} width={width} />
        </Box>
    );
};

export default ApertureElementContainer;
