import './styles.css';
import { Box, Grid } from '@mui/material';

import { TableHeader } from './TableHeader';
import { GlazingRow, FrameRow } from './TableRows';
import { TableGroupProps } from './types';

const GroupTitle: React.FC<{ title: string }> = ({ title }) => {
    return (
        <Grid size={12} sx={{ fontWeight: 'bold', mb: 1 }}>
            {title}
        </Grid>
    );
};

export const ApertureElementTableGroup: React.FC<TableGroupProps> = ({ aperture, element, isSelected }) => {
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
                <FrameRow rowIndex={1} aperture={aperture} element={element} position="top" />
                <FrameRow rowIndex={2} aperture={aperture} element={element} position="right" />
                <FrameRow rowIndex={3} aperture={aperture} element={element} position="bottom" />
                <FrameRow rowIndex={4} aperture={aperture} element={element} position="left" />
            </Grid>
        </Box>
    );
};
