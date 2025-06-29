import React, { useContext } from 'react';
import { Box, Select, MenuItem } from '@mui/material';

import { SegmentType, SpecificationStatus } from '../_types/Segment';
import { UserContext } from '../../../../../auth/_contexts/UserContext';

const getDesignSpecificationText = (value: SpecificationStatus) => {
    switch (value) {
        case SpecificationStatus.COMPLETE:
            return 'Design Spec.Complete';
        case SpecificationStatus.QUESTION:
            return 'Design Spec. Question';
        case SpecificationStatus.MISSING:
            return 'Design Spec. Missing';
        case SpecificationStatus.NA:
            return 'N/A';
        default:
            return 'N/A';
    }
};

interface DesignSpecificationStatusPropsType {
    segment: SegmentType;
    specificationStatus: any;
    onChangeSpecificationStatus: any;
}

const DesignSpecificationStatus: React.FC<DesignSpecificationStatusPropsType> = props => {
    const userContext = useContext(UserContext);

    return (
        <Box sx={{ flex: 1, alignItems: 'left', display: 'flex', flexDirection: 'column' }}>
            <Select
                className={`row-item specification-dropdown have-specification-${props.specificationStatus}`}
                value={props.specificationStatus}
                onChange={
                    userContext.user
                        ? props.onChangeSpecificationStatus
                        : () => {
                              alert('Please log in to update the status.');
                          }
                }
                size="small"
                sx={{ minWidth: 200, fontSize: '0.7rem' }}
                disabled={userContext.user === null}
            >
                {Object.values(SpecificationStatus).map(value => (
                    <MenuItem key={value} value={value}>
                        {getDesignSpecificationText(value)}
                    </MenuItem>
                ))}
            </Select>
        </Box>
    );
};

export default DesignSpecificationStatus;
