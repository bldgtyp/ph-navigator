import React, { useContext } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';
import { UserContext } from '../../../../../../../auth/_contexts/UserContext';
import { ApertureElementFrameType } from '../../types';
import { useApertureElementFrames } from '../Aperture.Frame.Context';

interface FrameSelectorProps {
    selectedFrame: ApertureElementFrameType | null;
    frameOptions: ApertureElementFrameType[];
    onFrameChange: (frame: ApertureElementFrameType | null) => void;
    isLoading?: boolean;
    placeholder?: string;
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
    selectedFrame,
    frameOptions,
    onFrameChange,
    isLoading = false,
    placeholder = 'Select frame',
}) => {
    const userContext = useContext(UserContext);
    const { frames } = useApertureElementFrames();

    if (!userContext.user) {
        // Show read-only display for non-logged-in users
        return <span>{selectedFrame?.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={frameOptions}
                getOptionLabel={option => option.name}
                value={selectedFrame}
                onChange={(event, newValue) => onFrameChange(newValue)}
                loading={isLoading}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder={placeholder}
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
