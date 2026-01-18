import { FormControl, Autocomplete, TextField } from '@mui/material';

import { useAssemblyContext } from '../Assembly/Assembly.Context';
import { AssemblyType } from '../../_types/Assembly';

const AssemblySelector: React.FC = () => {
    const { assemblies, selectedAssembly, setSelectedAssemblyId } = useAssemblyContext();

    // Sort assemblies alphabetically by name (matches sidebar ordering)
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

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
                options={sortedAssemblies}
                getOptionLabel={(option: AssemblyType) => option.name}
                value={selectedAssembly}
                onChange={(_, newValue) => {
                    if (newValue) {
                        setSelectedAssemblyId(newValue.id);
                    }
                }}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                size="small"
                renderInput={params => (
                    <TextField
                        {...params}
                        placeholder="Select assembly..."
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

export default AssemblySelector;
