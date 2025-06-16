import React, { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button } from '@mui/material';

interface ChangeNameModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (newName: string) => void;
}

const ChangeNameModal: React.FC<ChangeNameModalProps> = ({ open, onClose, onSubmit }) => {
    const [newName, setNewName] = useState('');

    const handleSubmit = () => {
        onSubmit(newName);
        setNewName(''); // Clear the input field
        onClose(); // Close the modal
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
                    value={newName}
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
