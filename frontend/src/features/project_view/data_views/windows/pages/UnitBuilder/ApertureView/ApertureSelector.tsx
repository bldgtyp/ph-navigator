import { FormControl, Autocomplete, TextField } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';
import { ApertureType } from '../types';

const ApertureSelector: React.FC = () => {
    const { apertures, activeAperture, handleSetActiveApertureById } = useApertures();

    // Sort apertures alphabetically by name
    const sortedApertures = [...apertures].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <FormControl
            sx={{
                minWidth: 330,
                maxWidth: 480,
                '& .MuiOutlinedInput-root': {
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--outline-color)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--text-secondary-color)',
                },
                '& .MuiAutocomplete-inputRoot': {
                    paddingTop: '4px',
                    paddingBottom: '4px',
                },
            }}
            size="small"
        >
            <Autocomplete
                options={sortedApertures}
                getOptionLabel={(option: ApertureType) => option.name}
                value={activeAperture}
                onChange={(_, newValue) => {
                    if (newValue) {
                        handleSetActiveApertureById(newValue.id);
                    }
                }}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder="Select aperture..."
                        variant="outlined"
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                fontSize: '0.875rem',
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        {option.name}
                    </li>
                )}
            />
        </FormControl>
    );
};

export default ApertureSelector;
