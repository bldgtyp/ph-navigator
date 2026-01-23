import { Grid } from '@mui/material';

import { TableCellProps, TableHeaderCellProps } from './types';

export const TableCell: React.FC<TableCellProps> = ({ children, size, className }) => {
    return (
        <Grid size={size} className={className} sx={{ py: 0.25 }}>
            {children}
        </Grid>
    );
};

export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({ children, size }) => {
    return (
        <Grid
            size={size}
            sx={{
                borderBottom: '1px solid #ccc',
                pb: 0.25,
                mb: 0.25,
                fontWeight: 600,
                fontSize: '0.7rem',
                color: 'text.secondary',
            }}
        >
            {children}
        </Grid>
    );
};
