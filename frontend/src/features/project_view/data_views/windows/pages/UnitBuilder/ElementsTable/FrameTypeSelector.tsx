import React, { useContext } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useApertures } from '../ApertureView/Aperture.Context';
import { FrameSelectorProps } from './types';
import { useFrameTypes } from './FrameType.Context';

export const FrameSelector: React.FC<FrameSelectorProps> = ({
    aperture,
    element,
    selectedFrame,
    isLoading = false,
    position,
}) => {
    const userContext = useContext(UserContext);
    const { frameTypes } = useFrameTypes();
    const { handleUpdateApertureElementFrame } = useApertures();
    const placeholderText = `Select ${position.toLowerCase()} frame`;

    if (!userContext.user) {
        return <span>{selectedFrame?.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={frameTypes}
                getOptionLabel={option => option.name}
                value={selectedFrame}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementFrame({
                        apertureId: aperture.id,
                        elementId: element.id,
                        framePosition: position,
                        frameId: newValue ? newValue.id : null,
                    })
                }
                loading={isLoading}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder={placeholderText}
                        variant="outlined"
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                fontSize: '0.75rem',
                                minHeight: 'auto',
                                '& .MuiOutlinedInput-input': {
                                    padding: '4px 8px',
                                },
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{option.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>
                                Width: {option.width_mm}mm, U-Value: {option.u_value_w_m2k}
                            </div>
                        </div>
                    </li>
                )}
            />
        </FormControl>
    );
};
