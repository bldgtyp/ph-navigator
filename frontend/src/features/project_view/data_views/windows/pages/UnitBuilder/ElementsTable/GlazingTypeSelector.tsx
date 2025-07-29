import { useContext } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useGlazingTypes } from './GlazingTypes.Context';
import { useApertures } from '../ApertureView/Aperture.Context';

import { GlazingSelectorProps } from './types';

export const GlazingSelector: React.FC<GlazingSelectorProps> = ({
    aperture,
    element,
    selectedGlazing,
    isLoading = false,
}) => {
    const userContext = useContext(UserContext);
    const { glazingTypes } = useGlazingTypes();
    const { handleUpdateApertureElementGlazing } = useApertures();
    const placeholderText = `Glazing type...`;

    if (!userContext.user) {
        return <span>{selectedGlazing?.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={glazingTypes}
                getOptionLabel={option => option.name}
                value={selectedGlazing}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementGlazing({
                        elementId: element.id,
                        glazingId: newValue ? newValue.id : null,
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
                                U-Value: {option.u_value_w_m2k}, g-Value: {option.g_value}
                            </div>
                        </div>
                    </li>
                )}
            />
        </FormControl>
    );
};
