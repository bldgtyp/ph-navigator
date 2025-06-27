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
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Assembly Name</DialogTitle>
            <DialogContent>
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                >
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Assembly Name"
                        type="text"
                        fullWidth
                        defaultValue={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </form>
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
