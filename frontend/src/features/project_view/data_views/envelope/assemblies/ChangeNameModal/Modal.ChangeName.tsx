import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button } from '@mui/material';
import { useAssemblySidebar } from '../Assembly/Sidebar/Sidebar.Context';

const ChangeNameModal: React.FC = () => {
    const { nameChangeModal, closeNameChangeModal, handleNameSubmit } = useAssemblySidebar();
    const [newName, setNewName] = useState(nameChangeModal.assemblyName);

    useEffect(() => {
        setNewName(nameChangeModal.assemblyName);
    }, [nameChangeModal.assemblyName, nameChangeModal.isOpen]);

    const handleSubmit = () => {
        if (newName.trim()) {
            handleNameSubmit(newName.trim());
        }
        closeNameChangeModal();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
        }
    };

    return (
        <Dialog open={nameChangeModal.isOpen} onClose={closeNameChangeModal} fullWidth maxWidth="xs">
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
                <Button onClick={closeNameChangeModal} color="secondary">
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    color="primary"
                    disabled={!newName.trim() || newName === nameChangeModal.assemblyName}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChangeNameModal;
