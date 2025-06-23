import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getWithAlert } from '../../../api/getWithAlert';
import { patchWithAlert } from '../../../api/patchWithAlert';
import { AirTableTableType } from '../../types/AirTableTableType';
import { projectSettingsDataType, defaultProjectSettingsData } from '../_types/Settings.Types';

export const useProjectSettingsHooks = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [projectSettingsData, setProjectSettingsData] = useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [projectSettingsFormData, setProjectSettingsFormData] =
        useState<projectSettingsDataType>(defaultProjectSettingsData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [airTableData, setAirTableData] = useState<AirTableTableType[]>([]); // Placeholder for AirTable data

    // Handler for updating a single AirTableListItem's at_ref Value set by the user
    const handleAirTableRefChange = (id: number, value: string) => {
        setAirTableData(prev => prev.map(table => (table.id === id ? { ...table, at_ref: value } : table)));
    };

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

                if (projectSettingsData?.airtable_base_id !== null) {
                    const airTableTables = await getWithAlert<AirTableTableType[]>(
                        `project/get-project-airtable-table-identifiers/${projectId}`
                    );
                    if (airTableTables) {
                        setAirTableData(airTableTables);
                    }
                }
            } catch (error) {
                alert('Error loading project data. Please try again later.');
                console.error('Error loading project data:', error);
            }
        }

        loadProjectSettings();
    }, [projectId]);

    const handleProjectSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProjectSettingsFormData(prev => ({
            ...prev,
            [name]: value, // Update the specific field in the form data
        }));
    };

    const handleSave = async () => {
        try {
            // Update the Project Settings
            const updateSettingsResponse = await patchWithAlert<projectSettingsDataType>(
                `project/update-settings/${projectId}`,
                null,
                projectSettingsFormData
            );
            if (updateSettingsResponse) {
                setProjectSettingsData(updateSettingsResponse);
            }

            // Update the AirTable tables identifiers
            const updateTablesResponse = await patchWithAlert<AirTableTableType[]>(
                `project/update-airtable-tables-identifiers/${projectId}`,
                null,
                airTableData
            );
            if (updateTablesResponse) {
                setAirTableData(updateTablesResponse);
            }

            alert('Project settings updated successfully.');
            navigate('/projects');
        } catch (error) {
            alert('Error saving project data. Please try again later.');
            console.error('Error saving project data:', error);
        }
    };

    const handleCancel = () => {
        setProjectSettingsFormData(projectSettingsData);
        navigate('/projects');
    };

    const handleDelete = async () => {
        // TODO: implement
    };

    return {
        handleConnectAirTableOnClick: handleConnectAirTableOnClick,
        projectSettingsFormData: projectSettingsFormData,
        airTableData: airTableData,
        handleAirTableRefChange: handleAirTableRefChange,
        projectSettingsData: projectSettingsData,
        isModalOpen: isModalOpen,
        handleModalClose: handleModalClose,
        handleCancel: handleCancel,
        handleDelete: handleDelete,
        handleSave: handleSave,
        handleProjectSettingChange: handleProjectSettingChange,
    };
};
