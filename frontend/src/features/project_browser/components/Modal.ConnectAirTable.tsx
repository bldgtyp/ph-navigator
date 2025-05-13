import React, { useState } from "react";
import { Button, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Divider, TextField, Typography } from "@mui/material";
import { postWithAlert } from "../../../api/postWithAlert";
import { useParams } from "react-router-dom";


interface OkCancelButtonsProps {
    handleModalClose: () => void;
}


const OkCancelButtons: React.FC<OkCancelButtonsProps> = (props) => {
    return (
        <DialogActions sx={{ display: "flex", flexDirection: 'row', justifyContent: "center" }}>
            <ButtonGroup variant="text">
                <Button onClick={props.handleModalClose} size="large" color="primary">
                    Cancel
                </Button>
                <Button type="submit" size="large" color="primary">
                    Save
                </Button>
            </ButtonGroup>
        </DialogActions>
    )
}


interface FormFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}


const FormField: React.FC<FormFieldProps> = (props) => {
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
    )
}


interface ModalConnectAirTableBaseType {
    bt_number: string;
    isModalOpen: boolean;
    handleModalClose: () => void;
}


interface formDataType {
    airtable_base_api_key: string;
    airtable_base_ref: string;
}


const ModalConnectAirTableBase: React.FC<ModalConnectAirTableBaseType> = (props) => {
    const { projectId } = useParams();
    const [formData, setFormData] = useState<formDataType>({
        airtable_base_api_key: "...",
        airtable_base_ref: "...",
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value, // Update the specific field in the form data
        }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            console.log("Connecting to AirTable base with data:", formData);
            // endpoint=/air_table/connect_at_base_to_project, token=..., data={"airtable_base_api_key":"pathyb8d4Hmu6AiLX.842da9fb1d9db5fbef8cb352d5722a43eece673c1d5d9c4046537979de738891","airtable_base_ref":"appEfDfirhVnByZxr","bt_number":""}
            const response = await postWithAlert("air_table/connect_at_base_to_project", null, { ...formData, bt_number: projectId });
            props.handleModalClose();
        } catch (error) {
            alert("Error connecting to AirTable base. Please try again.");
            console.error("Error:", error);
        }
    };

    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth>
            <DialogTitle>Project {props.bt_number}: Connect to an AirTable Base</DialogTitle>
            <Divider />
            <Typography variant="body2" sx={{ padding: "25px", textAlign: "left" }}>
                Connect to an existing AirTable &apos;Base&apos; to enable project data view. Make sure that that &apos;Base&apos; has the correct &apos;read&apos; permissions before trying to connect.
            </Typography>
            <form onSubmit={handleFormSubmit}>
                <DialogContent>
                    <FormField
                        label="AirTable Base Ref (ie: appEfDfirhVnByZxr)"
                        name="airtable_base_ref"
                        value={formData.airtable_base_ref}
                        onChange={handleInputChange}
                    />
                    <FormField
                        label="API Key (from AirTable Builder-Hub)"
                        name="airtable_base_api_key"
                        value={formData.airtable_base_api_key}
                        onChange={handleInputChange}
                    />
                </DialogContent>

                <DialogActions sx={{ display: "flex", flexDirection: 'row', justifyContent: "center" }}>
                    <ButtonGroup>
                        <Button onClick={props.handleModalClose} size="large" color="primary">
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                        >
                            Connect
                        </Button>
                    </ButtonGroup>
                </DialogActions>
            </form>
        </Dialog>
    );
};


export default ModalConnectAirTableBase;