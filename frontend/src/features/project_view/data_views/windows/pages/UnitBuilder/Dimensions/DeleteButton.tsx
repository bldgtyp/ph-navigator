import { useContext } from 'react';
import { IconButton } from '@mui/material';
import RemoveCircleTwoToneIcon from '@mui/icons-material/RemoveCircleTwoTone';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';

const DeleteButton: React.FC<{ index: number; handleDelete: (index: number) => void }> = ({ index, handleDelete }) => {
    const userContext = useContext(UserContext);

    return userContext.user ? (
        <IconButton
            sx={{ p: 0, color: 'rgba(0, 0, 0, 0.34)' }}
            className="delete-button"
            onClick={e => {
                handleDelete(index);
            }}
        >
            <RemoveCircleTwoToneIcon fontSize="small" />
        </IconButton>
    ) : null;
};

export default DeleteButton;
