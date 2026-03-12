import { ClickAwayListener, TextField, Tooltip, Typography } from '@mui/material';

import { DIMENSION_INPUT_WIDTH_PX, DIMENSION_TOOLTIP_DELAY_MS } from './constants';
import { useDimensions } from './Dimensions.Context';
import { useDisplayUnit } from './DisplayUnit.Context';
import type { DisplayUnit } from './types';

export const DimensionLabel: React.FC<any> = ({ handleEditStart, index, value, orientation }) => {
    const { units } = useDimensions();
    const { formatValue, activeDisplayUnit } = useDisplayUnit();

    const displayValue = formatValue(value);
    // For ft-in mode the formatted string already contains ' and " markers
    const label = activeDisplayUnit === 'ft-in' ? displayValue : `${displayValue} ${units}`;

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
            {label}
        </Typography>
    );
};

const TOOLTIP_BY_UNIT: Record<DisplayUnit, string> = {
    mm: 'Tip: You can use expressions like 100 + 50',
    cm: 'Tip: You can use expressions like 10 + 5',
    m: 'Tip: You can use expressions like 1.2 + 0.5',
    in: 'Tip: Use 2\' 6", 6-1/2", or expressions like 24 + 12',
    ft: 'Tip: You can use expressions like 3.5 + 1.25',
    'ft-in': 'Tip: Use 2\' 6", 6-1/2", or expressions like 24 + 12',
};

export const DimensionEditable: React.FC<any> = ({ handleEditConfirm }) => {
    const { units, editingValue, setEditingValue } = useDimensions();
    const { activeDisplayUnit } = useDisplayUnit();
    const inputTooltip = TOOLTIP_BY_UNIT[activeDisplayUnit];
    const showEndAdornment = activeDisplayUnit !== 'ft-in';

    return (
        <ClickAwayListener onClickAway={handleEditConfirm}>
            <Tooltip title={inputTooltip} enterDelay={DIMENSION_TOOLTIP_DELAY_MS} placement="top">
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
                            endAdornment: showEndAdornment ? (
                                <Typography variant="caption" color="text.secondary">
                                    {units}
                                </Typography>
                            ) : undefined,
                        },
                    }}
                />
            </Tooltip>
        </ClickAwayListener>
    );
};
