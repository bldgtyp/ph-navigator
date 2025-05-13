import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, TextField, Box, Stack, Typography } from "@mui/material";
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';

import { getWithAlert } from "../../../api/getWithAlert";
import { patchWithAlert } from "../../../api/patchWithAlert";
import ModalConnectAirTableBase from "./Modal.ConnectAirTable";


interface projectSettingsDataType {
    id: number;
    name: string;
    bt_number: string;
    phius_number: string | null;
    phius_dropbox_url: string | null;
    owner_id: number;
    airtable_base_ref: string | null;
}

const defaultProjectSettingsData = {
    id: 0,
    name: "",
    bt_number: "",
    phius_number: null,
    phius_dropbox_url: null,
    owner_id: 0,
    airtable_base_ref: null,
};

const Settings: React.FC = () => {
    const { projectId } = useParams();
    const [projectSettingsData, setProjectSettingsData] = useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [formData, setFormData] = useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleConnectAirTableOnClick = () => { setIsModalOpen(true); }
    const handleModalClose = () => { setIsModalOpen(false); }

    useEffect(() => {
        async function loadProjectSettings() {
            try {
                const projectSettingsData = await getWithAlert<projectSettingsDataType>(`project/${projectId}/get_settings`);
                if (projectSettingsData) {
                    setProjectSettingsData(projectSettingsData);
                    setFormData(projectSettingsData); // Initialize form data
                }
            } catch (error) {
                alert("Error loading project data. Please try again later.");
                console.error("Error loading project data:", error);
            }
        }

        loadProjectSettings();
    }, [projectId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value, // Update the specific field in the form data
        }));
    };

    const handleSave = async () => {
        try {
            const response = await patchWithAlert<any>(`project/${projectId}/update_settings`, null, formData);
            if (response) {
                alert("Project settings updated successfully!");
                setProjectSettingsData(formData); // Update the original data
            }
        } catch (error) {
            alert("Error saving project data. Please try again later.");
            console.error("Error saving project data:", error);
        }
    };

    const handleCancel = () => {
        setFormData(projectSettingsData);
    };

    const handleDelete = async () => {
        // TODO
    };

    return (
        <Box sx={{ p: 3 }}>

            <Typography variant="h4" sx={{ mt: 3, mb: 3 }}>
                Project Settings:
            </Typography>

            <Stack spacing={2}>
                <TextField
                    label="Project Name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="BLDGTYP Project Number"
                    name="bt_number"
                    value={formData.bt_number}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Project Number"
                    name="phius_number"
                    value={formData.phius_number || ""}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Dropbox URL"
                    name="phius_dropbox_url"
                    value={formData.phius_dropbox_url || ""}
                    onChange={handleInputChange}
                    fullWidth
                />
            </Stack>

            <Typography variant="h4" sx={{ mt: 3, mb: 3 }}>
                AirTable Base Settings:
            </Typography>

            <Stack spacing={2} >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ display: "flex" }}>
                    <TextField
                        label="AirTable Base Ref."
                        name="airtable_base_ref"
                        value={formData.airtable_base_ref || ""}
                        onChange={handleInputChange}
                        disabled
                        sx={{ flex: 1 }}
                    />
                    <Button
                        size="medium"
                        variant="contained"
                        sx={{ flex: 0.5, p: 2 }}
                        endIcon={<DatasetLinkedOutlinedIcon />}
                        onClick={handleConnectAirTableOnClick}
                    >
                        Connect an AirTable Base
                    </Button>
                </Stack>
            </Stack>

            <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
                <Button variant="outlined" color="secondary" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button variant="contained" color="error" onClick={handleDelete}>
                    Delete Project
                </Button>
                <Button variant="contained" color="primary" onClick={handleSave}>
                    Save
                </Button>
            </Box>

            <ModalConnectAirTableBase
                bt_number={projectSettingsData.bt_number}
                isModalOpen={isModalOpen}
                handleModalClose={handleModalClose}
            />
        </Box>
    );
};

export default Settings;