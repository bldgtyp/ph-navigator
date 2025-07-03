import React from 'react';
import { ClickAwayListener, TextField, Typography } from '@mui/material';
import { useDimensions } from './Dimensions.Context';

export const DimensionLabel: React.FC<any> = ({ handleEditStart, index, value, orientation }) => {
    const { units } = useDimensions();

    return (
        <Typography
            variant="caption"
            sx={{
                transform: orientation === 'vertical' ? 'rotate(-90deg)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.05)',
                    borderRadius: 1,
                    px: 0.5,
                },
            }}
            onClick={() => handleEditStart(index, value)}
        >
            {value} {units}
        </Typography>
    );
};

export const DimensionEditable: React.FC<any> = ({ handleEditConfirm }) => {
    const units = 'mm';
    const { editingValue, setEditingValue } = useDimensions();

    return (
        <ClickAwayListener onClickAway={handleEditConfirm}>
            <TextField
                size="small"
                autoFocus
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                variant="outlined"
                sx={{
                    width: '80px',
                    '& .MuiInputBase-input': {
                        py: 0.5,
                        px: 1,
                        fontSize: '0.75rem',
                        textAlign: 'center',
                    },
                }}
                slotProps={{
                    input: {
                        onFocus: event => {
                            event.target.select();
                        },
                        endAdornment: (
                            <Typography variant="caption" color="text.secondary">
                                {units}
                            </Typography>
                        ),
                    },
                }}
            />
        </ClickAwayListener>
    );
};
