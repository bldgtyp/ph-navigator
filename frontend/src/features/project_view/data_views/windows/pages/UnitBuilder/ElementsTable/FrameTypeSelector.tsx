import { useContext, useMemo } from 'react';
import { FormControl, Autocomplete, TextField } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useFrameTypes } from '../../../_contexts/FrameType.Context';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { useManufacturerFilters } from '../../../_contexts/ManufacturerFilter.Context';

import { FrameSelectorProps } from './types';

export const FrameSelector: React.FC<FrameSelectorProps> = ({
    aperture,
    element,
    selectedFrameType,
    isLoading = false,
    position,
}) => {
    const userContext = useContext(UserContext);
    const { frameTypes } = useFrameTypes();
    const { handleUpdateApertureElementFrameType } = useApertures();
    const { filterConfig, enabledFrameManufacturers } = useManufacturerFilters();
    const placeholderText = `Select ${position.toLowerCase()} frame`;

    const filteredFrameTypes = useMemo(() => {
        if (!filterConfig) {
            return frameTypes;
        }

        return frameTypes.filter(frame => {
            if (!frame.manufacturer) {
                return true;
            }
            return enabledFrameManufacturers.includes(frame.manufacturer);
        });
    }, [frameTypes, filterConfig, enabledFrameManufacturers]);

    if (!userContext.user) {
        return <span>{selectedFrameType?.name || '-'}</span>;
    }

    return (
        <FormControl fullWidth size="small">
            <Autocomplete
                options={[...filteredFrameTypes].sort((a, b) => a.name.localeCompare(b.name))}
                getOptionLabel={option => option.name}
                value={selectedFrameType}
                onChange={(event, newValue) =>
                    handleUpdateApertureElementFrameType({
                        apertureId: aperture.id,
                        elementId: element.id,
                        framePosition: position,
                        frameTypeId: newValue ? newValue.id : null,
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
