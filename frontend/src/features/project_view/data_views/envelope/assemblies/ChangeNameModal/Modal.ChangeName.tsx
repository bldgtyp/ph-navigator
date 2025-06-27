import React, { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button } from '@mui/material';

interface ChangeNameModalProps {
    assemblyName: string;
    open: boolean;
    onClose: () => void;
    onSubmit: (newName: string) => void;
}

const ChangeNameModal: React.FC<ChangeNameModalProps> = ({ assemblyName, open, onClose, onSubmit }) => {
    const [newName, setNewName] = useState(assemblyName);

    const handleSubmit = () => {
        onSubmit(newName);
        setNewName(newName);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Change Assembly Name</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="New Assembly Name"
                    type="text"
                    fullWidth
                    defaultValue={assemblyName}
                    onChange={e => setNewName(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} color="primary">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChangeNameModal;
