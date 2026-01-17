import { useContext, useCallback } from 'react';
import { FormControl, Select, MenuItem, Checkbox, FormControlLabel, Box, SelectChangeEvent } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { ApertureElementType, ElementOperation, OperationType, OperationDirection } from '../types';

interface OperationEditorProps {
    element: ApertureElementType;
}

type OperationTypeOption = 'fixed' | 'swing' | 'slide';

const OPERATION_TYPE_LABELS: Record<OperationTypeOption, string> = {
    fixed: 'Fixed',
    swing: 'Swing',
    slide: 'Slide',
};

const DIRECTION_LABELS: Record<OperationDirection, string> = {
    left: 'Left',
    right: 'Right',
    up: 'Up',
    down: 'Down',
};

export const OperationEditor: React.FC<OperationEditorProps> = ({ element }) => {
    const userContext = useContext(UserContext);
    const { handleUpdateApertureElementOperation } = useApertures();

    const currentType: OperationTypeOption = element.operation?.type || 'fixed';
    const currentDirections: OperationDirection[] = element.operation?.directions || [];

    const getDisplayLabel = (): string => {
        if (!element.operation) {
            return 'Fixed';
        }
        const typeLabel = OPERATION_TYPE_LABELS[element.operation.type];
        if (element.operation.directions.length === 0) {
            return typeLabel;
        }
        const directionLabels = element.operation.directions.map(d => DIRECTION_LABELS[d]).join(', ');
        return `${typeLabel} (${directionLabels})`;
    };

    const handleTypeChange = useCallback(
        (event: SelectChangeEvent<OperationTypeOption>) => {
            const newType = event.target.value as OperationTypeOption;

            if (newType === 'fixed') {
                handleUpdateApertureElementOperation(element.id, null);
            } else {
                const newOperation: ElementOperation = {
                    type: newType as OperationType,
                    directions: [],
                };
                handleUpdateApertureElementOperation(element.id, newOperation);
            }
        },
        [element.id, handleUpdateApertureElementOperation]
    );

    const handleDirectionToggle = useCallback(
        (direction: OperationDirection) => {
            if (!element.operation) return;

            const newDirections = currentDirections.includes(direction)
                ? currentDirections.filter(d => d !== direction)
                : [...currentDirections, direction];

            const newOperation: ElementOperation = {
                type: element.operation.type,
                directions: newDirections,
            };

            handleUpdateApertureElementOperation(element.id, newOperation);
        },
        [element.id, element.operation, currentDirections, handleUpdateApertureElementOperation]
    );

    // Read-only view for non-authenticated users
    if (!userContext.user) {
        return <span>{getDisplayLabel()}</span>;
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                    value={currentType}
                    onChange={handleTypeChange}
                    size="small"
                    sx={{
                        fontSize: '0.75rem',
                        '& .MuiSelect-select': {
                            padding: '4px 8px',
                        },
                    }}
                >
                    <MenuItem value="fixed">Fixed</MenuItem>
                    <MenuItem value="swing">Swing</MenuItem>
                    <MenuItem value="slide">Slide</MenuItem>
                </Select>
            </FormControl>

            {currentType !== 'fixed' && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(['left', 'right', 'up', 'down'] as OperationDirection[]).map(direction => (
                        <FormControlLabel
                            key={direction}
                            control={
                                <Checkbox
                                    checked={currentDirections.includes(direction)}
                                    onChange={() => handleDirectionToggle(direction)}
                                    size="small"
                                    sx={{ padding: '2px' }}
                                />
                            }
                            label={DIRECTION_LABELS[direction]}
                            sx={{
                                marginLeft: 0,
                                marginRight: 1,
                                '& .MuiFormControlLabel-label': {
                                    fontSize: '0.7rem',
                                },
                            }}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};
