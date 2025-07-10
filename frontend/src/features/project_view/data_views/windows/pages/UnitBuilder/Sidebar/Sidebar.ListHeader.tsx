import { useContext } from 'react';
import { Button, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';

const ApertureListHeader: React.FC<{ onAddAperture: () => void }> = ({ onAddAperture }) => {
    const userContext = useContext(UserContext);
    if (!userContext.user) return null;

    return (
        <Tooltip title="Add a new Aperture to the Project" placement="top" arrow>
            <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ marginBottom: 2, minWidth: '120px', width: '100%', color: 'inherit' }}
                onClick={onAddAperture}
            >
                + Add New Aperture
            </Button>
        </Tooltip>
    );
};

export default ApertureListHeader;
