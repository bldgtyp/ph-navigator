import { ClickAwayListener, TextField, Tooltip, Typography } from '@mui/material';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { DIMENSION_INPUT_WIDTH_PX, DIMENSION_TOOLTIP_DELAY_MS } from './constants';
import { useDimensions } from './Dimensions.Context';

export const DimensionLabel: React.FC<any> = ({ handleEditStart, index, value, orientation }) => {
    const { units } = useDimensions();
    const { valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    // Convert the SI value (mm) to current unit system for display
    const displayValue = parseFloat(valueInCurrentUnitSystemWithDecimal(value, 'mm', 'in', 1));

    return (
        <Typography
            variant="caption"
            sx={{
                transform: orientation === 'vertical' ? 'rotate(-90deg)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                bgcolor: 'background.paper',
                px: 0.5,
                py: 0.25,
                borderRadius: 1,
                '&:hover': {
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                },
            }}
            onClick={() => handleEditStart(index, value)}
        >
            {displayValue} {units}
        </Typography>
    );
};

export const DimensionEditable: React.FC<any> = ({ handleEditConfirm }) => {
    const { units, editingValue, setEditingValue } = useDimensions();

    return (
        <ClickAwayListener onClickAway={handleEditConfirm}>
            <Tooltip
                title="Tip: You can use expressions like 100 + 50"
                enterDelay={DIMENSION_TOOLTIP_DELAY_MS}
                placement="top"
            >
                <TextField
                    size="small"
                    autoFocus
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                    variant="outlined"
                    sx={{
                        width: `${DIMENSION_INPUT_WIDTH_PX}px`,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        '& .MuiInputBase-root': {
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                        },
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
            </Tooltip>
        </ClickAwayListener>
    );
};
