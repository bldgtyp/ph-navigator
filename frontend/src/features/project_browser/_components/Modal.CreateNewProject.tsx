import React, { useState } from 'react';
import {
    Button,
    ButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    TextField,
} from '@mui/material';

interface OkCancelButtonsProps {
    handleModalClose: () => void;
}

const OkCancelButtons: React.FC<OkCancelButtonsProps> = props => {
    return (
        <DialogActions sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
            <ButtonGroup variant="text">
                <Button onClick={props.handleModalClose} size="large" color="primary">
                    Cancel
                </Button>
                <Button type="submit" size="large" color="primary">
                    Save
                </Button>
            </ButtonGroup>
        </DialogActions>
    );
};

interface FormFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface formDataType {
    name: string;
    bt_number: string;
    phius_number: string | null;
    phius_dropbox_url: string | null;
}

const FormField: React.FC<FormFieldProps> = props => {
    return (
        <TextField
            type="text"
            label={props.label}
            name={props.name}
            value={props.value}
            onChange={props.onChange}
            fullWidth
            margin="normal"
        />
    );
};

interface ModalCreateNewProjectType {
    isModalOpen: boolean;
    handleModalClose: () => void;
    handleSubmit: (formData: formDataType) => void;
}

const ModalCreateNewProject: React.FC<ModalCreateNewProjectType> = props => {
    // Single state object for form data
    const [formData, setFormData] = useState({
        name: '',
        bt_number: '',
        phius_number: '',
        phius_dropbox_url: '',
    });

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value, // Update the specific field in the form data
        }));
    };

    // Handle form submission
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        props.handleSubmit(formData); // Pass the form data to the parent component
    };

    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose}>
            <DialogTitle>Create New Project</DialogTitle>
            <Divider />
            <form onSubmit={handleFormSubmit}>
                <DialogContent>
                    <FormField label="Project Name" name="name" value={formData.name} onChange={handleInputChange} />
                    <FormField
                        label="Building Type Project Number"
                        name="bt_number"
                        value={formData.bt_number}
                        onChange={handleInputChange}
                    />
                    <FormField
                        label="PHIUS Project Number"
                        name="phius_number"
                        value={formData.phius_number}
                        onChange={handleInputChange}
                    />
                    <FormField
                        label="PHIUS Dropbox URL"
                        name="phius_dropbox_url"
                        value={formData.phius_dropbox_url}
                        onChange={handleInputChange}
                    />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>
        </Dialog>
    );
};

export default ModalCreateNewProject;
