// See: https://mui.com/x/react-data-grid/style/

import React from 'react';
import { DataGridProps } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';

const _StyledDataGrid = styled(DataGrid)(({ theme }) => ({
    border: 0,
    marginBottom: '40px',
    color: theme.palette.mode === 'light' ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,0.85)',
    WebkitFontSmoothing: 'auto',
    letterSpacing: 'normal',
    '& .MuiDataGrid-virtualScrollerContent': {
        paddingBottom: '16px',
        transform: 'translate(0, 16px)', // Fix the vertical scrollbar position
    },
    '& .MuiDataGrid-virtualScroller': {
        overflow: 'auto',
    },
    '& .MuiDataGrid-columnsContainer': {
        backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#1d1d1d',
    },
    '& .MuiDataGrid-iconSeparator': {
        display: 'none',
    },
    '& .MuiDataGrid-columnHeader, .MuiDataGrid-columnHeaderTitle': {
        fontWeight: '600',
        borderBottom: `2px solid`,
        fontSize: '0.75rem',
    },
    '& .MuiDataGrid-columnHeader, .MuiDataGrid-cell': {
        borderRight: `1px solid ${theme.palette.mode === 'light' ? '#f0f0f0' : '#303030'}`,
    },
    '& .MuiDataGrid-columnsContainer, .MuiDataGrid-cell': {
        borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#f0f0f0' : '#303030'}`,
    },
    '& .MuiDataGrid-cell': {
        color: theme.palette.mode === 'light' ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,0.65)',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
    },
    '& .MuiDataGrid-columnHeaders': {
        height: '40px', // Reduce header height
    },
    '& .MuiDataGrid-footerContainer': {
        minHeight: '40px', // Reduce footer height (pagination area)
    },
    '& .MuiPaginationItem-root': {
        borderRadius: 0,
        fontSize: '0.75rem', // Smaller font size for pagination
    },
    '& .datasheet-link': {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Make custom checkboxes that will work in Firefox as well as Chrome.
    // regular checkboxes don't work in Firefox.
    '& .checkbox-cell': {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    '& .checkbox-checked': {
        display: 'inline-block',
        width: '1.25em',
        height: '1.25em',
        marginRight: '0.5em',
        border: '1px solid grey',
        verticalAlign: 'text-bottom',
        borderRadius: '3px',
        background: 'green',
        position: 'relative', // Ensure the ::after is positioned relative to this box
        '&::after': {
            content: '"\u2714"', // Heavy Check Mark
            fontFamily: 'Arial, sans-serif', // Ensure the font supports the checkmark
            color: 'white',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '0.9em',
            zIndex: 1,
        },
    },
    '& .checkbox-na': {
        position: 'relative',
        display: 'inline-block',
        width: ' 1.25em',
        height: '1.25em',
        marginRight: '0.5em',
        border: '1px solid lightgrey',
        verticalAlign: 'text-bottom',
        boxShadow: 'inset 0 0 0.2em 0.1em lightgrey',
        '&::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '0',
            width: '100%',
            height: '1px',
            backgroundColor: 'lightgrey',
            transform: 'rotate(-45deg)',
        },
    },
    '& .checkbox-needed': {
        display: 'relative',
        width: ' 1.25em',
        height: '1.25em',
        marginRight: '0.5em',
        border: '1px solid red',
        borderRadius: '3px',
        verticalAlign: 'text-bottom',
        boxShadow: 'inset 0 0 0.1em 0.05em red, 0 0 0.4em 0.01em red',
    },
    '& .checkbox-question': {
        position: 'relative',
        display: 'inline-block',
        width: ' 1.25em',
        height: '1.25em',
        marginRight: '0.5em',
        border: '0.5px solid red',
        borderRadius: '3px',
        verticalAlign: 'text-bottom',
        boxShadow: 'inset 0 0 0.05em 0.02em red, 0 0 0.4em 0.01em red',
        backgroundColor: 'red',
        '&::after': {
            content: '"?"',
            color: 'white',
            position: 'relative',
            top: '-20%',
            fontWeight: 'bold',
        },
    },
    '& .critical-info-icon': {
        color: 'red',
    },
    '& .notes-icon': {
        color: 'orange',
    },
    theme,
}));

// Create a wrapper component to set default props
const StyledDataGrid: React.FC<DataGridProps> = props => {
    return (
        <_StyledDataGrid
            rowHeight={40}
            initialState={{
                pagination: {
                    paginationModel: { page: 0, pageSize: 10 },
                },
            }}
            pageSizeOptions={[10, 50, 100]}
            scrollbarSize={16}
            checkboxSelection
            {...props} // Allow overriding defaults
        />
    );
};

export default StyledDataGrid;
