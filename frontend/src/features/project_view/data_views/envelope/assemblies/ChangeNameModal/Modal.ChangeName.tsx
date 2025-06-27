import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button } from '@mui/material';

interface ChangeNameModalProps {
    assemblyName: string;
    open: boolean;
    onClose: () => void;
    onSubmit: (newName: string) => void;
}

const ChangeNameModal: React.FC<ChangeNameModalProps> = ({ assemblyName, open, onClose, onSubmit }) => {
    const [newName, setNewName] = useState(assemblyName);

    // Reset the name when the modal opens with a different assembly
    useEffect(() => {
        setNewName(assemblyName);
    }, [assemblyName, open]);

    const handleSubmit = () => {
        if (newName.trim()) {
            onSubmit(newName.trim());
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
                    onKeyDown={handleKeyDown}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} color="primary" disabled={!newName.trim() || newName === assemblyName}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChangeNameModal;
