import React from 'react';
import { Box, Grid } from '@mui/material';
import { TableGroupProps } from './types';
import { TableHeader } from './TableHeader';
import { GlazingRow, FrameRow } from './TableRows';
import './ApertureTable.styles.css';

const GroupTitle: React.FC<{ title: string }> = ({ title }) => {
    return (
        <Grid size={12} sx={{ fontWeight: 'bold', mb: 1 }}>
            {title}
        </Grid>
    );
};

export const ApertureElementTableGroup: React.FC<TableGroupProps> = ({ element, isSelected }) => {
    const groupTitle = element.name || `Element ${element.id}`;

    return (
        <Box
            className="aperture-table-group"
            sx={{
                outline: isSelected ? '2px solid blue' : 'none',
                border: '1px solid var(--outline-color)',
                borderRadius: '4px',
                p: 0,
                mt: 2,
                fontSize: '0.75rem',
                boxSizing: 'border-box',
            }}
        >
            {/* Title Section */}
            <Grid
                container
                sx={{
                    margin: 1,
                    rowGap: '2px',
                    columnGap: '0px',
                }}
            >
                <GroupTitle title={groupTitle} />
                <TableHeader />
            </Grid>

            {/* Content Section with Zebra Striping */}
            <Grid
                container
                sx={{
                    margin: 1,
                    rowGap: '0px',
                    columnGap: '0px',
                }}
            >
                <GlazingRow name="Glazing" glazing={element.glazing} rowIndex={0} />
                <FrameRow name="Top Frame" frame={element.frames.top} rowIndex={1} />
                <FrameRow name="Right Frame" frame={element.frames.right} rowIndex={2} />
                <FrameRow name="Bottom Frame" frame={element.frames.bottom} rowIndex={3} />
                <FrameRow name="Left Frame" frame={element.frames.left} rowIndex={4} />
            </Grid>
        </Box>
    );
};
