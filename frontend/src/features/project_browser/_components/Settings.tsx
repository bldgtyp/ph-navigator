import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, TextField, Box, Stack, Typography, InputAdornment } from '@mui/material';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';

import { getWithAlert } from '../../../api/getWithAlert';
import { patchWithAlert } from '../../../api/patchWithAlert';
import ModalConnectAirTableBase from './Modal.ConnectAirTable';
import { AirTableTableType } from '../../types/AirTableTableType';

interface projectSettingsDataType {
    id: number;
    name: string;
    bt_number: string;
    phius_number: string | null;
    phius_dropbox_url: string | null;
    owner_id: number;
    airtable_base_id: string | null;
    airtable_base_url: string | null;
}

const defaultProjectSettingsData = {
    id: 0,
    name: '',
    bt_number: '',
    phius_number: null,
    phius_dropbox_url: null,
    owner_id: 0,
    airtable_base_id: null,
    airtable_base_url: null,
};

const AirTableListItem: React.FC<{ key: number; table: AirTableTableType }> = ({ table }) => {
    return (
        <Box key={table.id} sx={{ p: 1 }}>
            <TextField
                variant="filled"
                size="small"
                name={table.name}
                defaultValue={table.at_ref}
                onChange={e => {}}
                fullWidth
                slotProps={{
                    input: {
                        startAdornment: <InputAdornment position="start">{table.name}: </InputAdornment>,
                    },
                }}
            />
        </Box>
    );
};

const Settings: React.FC = () => {
    const { projectId } = useParams();
    const [projectSettingsData, setProjectSettingsData] = useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [projectSettingsFormData, setProjectSettingsFormData] =
        useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [airTableData, setAirTableData] = useState<AirTableTableType[]>([]); // Placeholder for AirTable data

    const handleConnectAirTableOnClick = () => {
        setIsModalOpen(true);
    };
    const handleModalClose = () => {
        setIsModalOpen(false);
    };

    useEffect(() => {
        async function loadProjectSettings() {
            try {
                const projectSettingsData = await getWithAlert<projectSettingsDataType>(`project/${projectId}`);
                if (projectSettingsData) {
                    setProjectSettingsData(projectSettingsData);
                    setProjectSettingsFormData(projectSettingsData); // Initialize form data
                }
                const airTableTables = await getWithAlert<AirTableTableType[]>(
                    `project/get-project-airtable-table-identifiers/${projectId}`
                );
                if (airTableTables) {
                    setAirTableData(airTableTables);
                }
            } catch (error) {
                alert('Error loading project data. Please try again later.');
                console.error('Error loading project data:', error);
            }
        }

        loadProjectSettings();
    }, [projectId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProjectSettingsFormData(prev => ({
            ...prev,
            [name]: value, // Update the specific field in the form data
        }));
    };

    const handleSave = async () => {
        try {
            // Update the Project Settings
            const updateSettingsResponse = await patchWithAlert<any>(
                `project/update-settings/${projectId}`,
                null,
                projectSettingsFormData
            );
            if (updateSettingsResponse) {
                setProjectSettingsData(projectSettingsFormData);
            }

            // Update the AirTable tables identifiers
            // TODO: Collect the updated inputs from the Form data....
            const updateTablesResponse = await patchWithAlert<any>(
                `project/update-airtable-tables-identifiers/${projectId}`,
                null,
                airTableData
            );
            if (updateTablesResponse) {
                setAirTableData(airTableData);
            }

            if (updateSettingsResponse && updateTablesResponse) {
                alert('Project settings updated successfully.');
            }
        } catch (error) {
            alert('Error saving project data. Please try again later.');
            console.error('Error saving project data:', error);
        }
    };

    // TODO: fix so it goes back to the project browser....
    const handleCancel = () => {
        setProjectSettingsFormData(projectSettingsData);
    };

    const handleDelete = async () => {
        // TODO
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mt: 3, mb: 3 }}>
                Project Settings:
            </Typography>

            <Box sx={{ mt: 3, mb: 6, display: 'flex', gap: 2 }}>
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

            <Stack spacing={2}>
                <TextField
                    label="Project Name"
                    name="name"
                    value={projectSettingsFormData.name}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="BLDGTYP Project Number"
                    name="bt_number"
                    value={projectSettingsFormData.bt_number}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Project Number"
                    name="phius_number"
                    value={projectSettingsFormData.phius_number || ''}
                    onChange={handleInputChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Dropbox URL"
                    name="phius_dropbox_url"
                    value={projectSettingsFormData.phius_dropbox_url || ''}
                    onChange={handleInputChange}
                    fullWidth
                />
            </Stack>

            {/* AirTable Connection Data */}
            <Typography variant="h4" sx={{ mt: 3, mb: 3 }}>
                AirTable Base Settings:
            </Typography>

            <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ display: 'flex' }}>
                    <Button
                        size="medium"
                        variant="contained"
                        sx={{ flex: 0.5, p: 2 }}
                        endIcon={<DatasetLinkedOutlinedIcon />}
                        onClick={handleConnectAirTableOnClick}
                    >
                        Connect an AirTable Base
                    </Button>
                    <TextField
                        label="AirTable Base Ref."
                        name="airtable_base_ref"
                        value={projectSettingsFormData.airtable_base_id || ''}
                        disabled
                        sx={{ flex: 1 }}
                    />
                </Stack>
            </Stack>

            {/* AirTable Table List */}
            <Stack sx={{ mt: 2 }}>
                {airTableData.map(table => {
                    return <AirTableListItem key={table.id} table={table} />;
                })}
            </Stack>

            <ModalConnectAirTableBase
                bt_number={projectSettingsData.bt_number}
                isModalOpen={isModalOpen}
                handleModalClose={handleModalClose}
            />
        </Box>
    );
};

export default Settings;
