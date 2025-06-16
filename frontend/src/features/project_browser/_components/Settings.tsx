import React from 'react';
import { Button, TextField, Box, Stack, Typography, InputAdornment } from '@mui/material';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';

import ModalConnectAirTableBase from './Modal.ConnectAirTable';
import { AirTableListItemPropsType } from '../_types/Settings.Types';
import { useProjectSettingsHooks } from './Settings.Hooks';

const AirTableListItem: React.FC<AirTableListItemPropsType> = props => {
    return (
        <Box key={props.key} sx={{ p: 1 }}>
            <TextField
                variant="filled"
                size="small"
                name={props.table.name}
                defaultValue={props.table.at_ref}
                onChange={props.onChange}
                fullWidth
                slotProps={{
                    input: {
                        startAdornment: <InputAdornment position="start">{props.table.name}: </InputAdornment>,
                    },
                }}
            />
        </Box>
    );
};

const Settings: React.FC = () => {
    const hooks = useProjectSettingsHooks();

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mt: 3, mb: 3 }}>
                Project Settings:
            </Typography>

            <Box sx={{ mt: 3, mb: 6, display: 'flex', gap: 2 }}>
                <Button variant="outlined" color="secondary" onClick={hooks.handleCancel}>
                    Cancel
                </Button>
                <Button variant="contained" color="error" onClick={hooks.handleDelete}>
                    Delete Project
                </Button>
                <Button variant="contained" color="primary" onClick={hooks.handleSave}>
                    Save
                </Button>
            </Box>

            <Stack spacing={2}>
                <TextField
                    label="Project Name"
                    name="name"
                    value={hooks.projectSettingsFormData.name}
                    onChange={hooks.handleProjectSettingChange}
                    fullWidth
                />
                <TextField
                    label="BLDGTYP Project Number"
                    name="bt_number"
                    value={hooks.projectSettingsFormData.bt_number}
                    onChange={hooks.handleProjectSettingChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Project Number"
                    name="phius_number"
                    value={hooks.projectSettingsFormData.phius_number || ''}
                    onChange={hooks.handleProjectSettingChange}
                    fullWidth
                />
                <TextField
                    label="PHIUS Dropbox URL"
                    name="phius_dropbox_url"
                    value={hooks.projectSettingsFormData.phius_dropbox_url || ''}
                    onChange={hooks.handleProjectSettingChange}
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
                        onClick={hooks.handleConnectAirTableOnClick}
                    >
                        Connect an AirTable Base
                    </Button>
                    <TextField
                        label="AirTable Base Ref."
                        name="airtable_base_ref"
                        value={hooks.projectSettingsFormData.airtable_base_id || ''}
                        disabled
                        sx={{ flex: 1 }}
                    />
                </Stack>
            </Stack>

            {/* AirTable Table List */}
            <Stack sx={{ mt: 2 }}>
                {hooks.airTableData.map(table => {
                    return (
                        <AirTableListItem
                            key={table.id}
                            table={table}
                            onChange={value => hooks.handleAirTableRefChange(table.id, value.target.value)}
                        />
                    );
                })}
            </Stack>

            <ModalConnectAirTableBase
                bt_number={hooks.projectSettingsData.bt_number}
                isModalOpen={hooks.isModalOpen}
                handleModalClose={hooks.handleModalClose}
            />
        </Box>
    );
};

export default Settings;
