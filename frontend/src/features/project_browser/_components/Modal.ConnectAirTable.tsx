import React, { useState } from 'react';
import {
    Alert,
    Button,
    ButtonGroup,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    TextField,
    Typography,
} from '@mui/material';
import { ApiError, fetchPost } from '../../../api/fetchApi';
import { useParams } from 'react-router-dom';

interface FormFieldProps {
    label: string;
    name: string;
    value: string;
    disabled: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FormField: React.FC<FormFieldProps> = props => {
    return (
        <TextField
            type="text"
            label={props.label}
            name={props.name}
            value={props.value}
            disabled={props.disabled}
            onChange={props.onChange}
            fullWidth
            margin="normal"
        />
    );
};

interface ModalConnectAirTableBaseType {
    bt_number: string;
    isModalOpen: boolean;
    handleModalClose: () => void;
}

interface formDataType {
    airtable_base_api_key: string;
    airtable_base_ref: string;
}

/** Extract a user-friendly message from the API error. */
function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.detail;
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred. Please try again.';
}

const ModalConnectAirTableBase: React.FC<ModalConnectAirTableBaseType> = props => {
    const { projectId } = useParams();
    const [formData, setFormData] = useState<formDataType>({
        airtable_base_api_key: '...',
        airtable_base_ref: '...',
    });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setErrorMessage(null);
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        try {
            await fetchPost('air_table/connect-AT-base-to-project', {
                ...formData,
                bt_number: projectId,
            });
            props.handleModalClose();
        } catch (error) {
            console.error('Error connecting to AirTable:', error);
            setErrorMessage(parseErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth>
            <DialogTitle>Project {props.bt_number}: Connect to an AirTable Base</DialogTitle>
            <Divider />
            <Typography variant="body2" sx={{ padding: '25px', textAlign: 'left' }}>
                Connect to an existing AirTable &apos;Base&apos; to enable project data view. Make sure that that
                &apos;Base&apos; has the correct &apos;read&apos; permissions before trying to connect.
            </Typography>
            <form onSubmit={handleFormSubmit}>
                <DialogContent>
                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
                            {errorMessage}
                        </Alert>
                    )}
                    <FormField
                        label="AirTable Base Ref (ie: appEfDfirhVnByZxr)"
                        name="airtable_base_ref"
                        value={formData.airtable_base_ref}
                        disabled={isLoading}
                        onChange={handleInputChange}
                    />
                    <FormField
                        label="API Key (from AirTable Builder-Hub)"
                        name="airtable_base_api_key"
                        value={formData.airtable_base_api_key}
                        disabled={isLoading}
                        onChange={handleInputChange}
                    />
                </DialogContent>

                <DialogActions sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                    <ButtonGroup>
                        <Button onClick={props.handleModalClose} size="large" color="primary" disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
                        >
                            {isLoading ? 'Connecting...' : 'Connect'}
                        </Button>
                    </ButtonGroup>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default ModalConnectAirTableBase;
