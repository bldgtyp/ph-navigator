import React from 'react';
import { Box, TextField, Typography, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

interface GridSizeControlsProps {
    columnWidths: number[];
    rowHeights: number[];
    onColumnWidthChange: (index: number, value: number) => void;
    onRowHeightChange: (index: number, value: number) => void;
}

const GridSizeControls: React.FC<GridSizeControlsProps> = ({
    columnWidths,
    rowHeights,
    onColumnWidthChange,
    onRowHeightChange,
}) => {
    const [editingCol, setEditingCol] = React.useState<number | null>(null);
    const [editingRow, setEditingRow] = React.useState<number | null>(null);

    const handleColumnChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value) && value > 0) {
            onColumnWidthChange(index, value);
        }
    };

    const handleRowChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value) && value > 0) {
            onRowHeightChange(index, value);
        }
    };

    return (
        <Box sx={{ mt: 4, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Grid Dimensions
            </Typography>

            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Column Widths</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {columnWidths.map((width, index) => (
                        <Box
                            key={`col-size-${index}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid #ddd',
                                borderRadius: 1,
                                p: 0.5,
                            }}
                        >
                            {editingCol === index ? (
                                <TextField
                                    size="small"
                                    autoFocus
                                    value={width}
                                    onChange={e => handleColumnChange(index, e as React.ChangeEvent<HTMLInputElement>)}
                                    onBlur={() => setEditingCol(null)}
                                    onKeyDown={e => e.key === 'Enter' && setEditingCol(null)}
                                    sx={{ width: '70px' }}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                            ) : (
                                <>
                                    <Typography variant="body2" sx={{ minWidth: '50px', textAlign: 'center' }}>
                                        {width}px
                                    </Typography>
                                    <IconButton size="small" onClick={() => setEditingCol(index)} sx={{ ml: 0.5 }}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box>
                <Typography variant="subtitle2">Row Heights</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {rowHeights.map((height, index) => (
                        <Box
                            key={`row-size-${index}`}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid #ddd',
                                borderRadius: 1,
                                p: 0.5,
                            }}
                        >
                            {editingRow === index ? (
                                <TextField
                                    size="small"
                                    autoFocus
                                    value={height}
                                    onChange={e => handleRowChange(index, e as React.ChangeEvent<HTMLInputElement>)}
                                    onBlur={() => setEditingRow(null)}
                                    onKeyDown={e => e.key === 'Enter' && setEditingRow(null)}
                                    sx={{ width: '70px' }}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                            ) : (
                                <>
                                    <Typography variant="body2" sx={{ minWidth: '50px', textAlign: 'center' }}>
                                        {height}px
                                    </Typography>
                                    <IconButton size="small" onClick={() => setEditingRow(index)} sx={{ ml: 0.5 }}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default GridSizeControls;
