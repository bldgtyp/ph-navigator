import React from 'react';
import { Grid } from '@mui/material';
import { TableCellProps, TableHeaderCellProps } from './types';

export const TableCell: React.FC<TableCellProps> = ({ children, size, className }) => {
    return (
        <Grid size={size} className={className} sx={{ py: 0.5 }}>
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
                pb: 0.5,
                mb: 0.5,
                fontWeight: 'bold',
            }}
        >
            {children}
        </Grid>
    );
};
