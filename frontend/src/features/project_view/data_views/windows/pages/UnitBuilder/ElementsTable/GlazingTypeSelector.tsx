import { useContext } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useGlazingTypes } from '../../../_contexts/GlazingTypes.Context';
import { useApertures } from '../../../_contexts/Aperture.Context';

import { GlazingSelectorProps } from './types';

export const GlazingSelector: React.FC<GlazingSelectorProps> = ({
    element,
    selectedGlazingType,
    isLoading = false,
}) => {
    const userContext = useContext(UserContext);
    const { glazingTypes } = useGlazingTypes();
    const { handleUpdateApertureElementGlazing } = useApertures();
    const placeholderText = `Glazing type...`;

    if (!userContext.user) {
        return <span>{selectedGlazingType.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={[...glazingTypes].sort((a, b) => a.name.localeCompare(b.name))}
                getOptionLabel={option => option.name}
                value={selectedGlazingType}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementGlazing({
                        elementId: element.id,
                        glazingTypeId: newValue ? newValue.id : null,
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
                            <div style={{ fontSize: '0.7em', color: '#666' }}>
                                U-Value: {option.u_value_w_m2k}, g-Value: {option.g_value}
                            </div>
                        </div>
                    </li>
                )}
            />
        </FormControl>
    );
};
