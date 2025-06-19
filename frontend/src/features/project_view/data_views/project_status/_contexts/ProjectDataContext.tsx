import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getWithAlert } from '../../../../../api/getWithAlert';
import { AirTableRecordType } from '../../../../types/AirTableRecordType';

const ProjectStatusDataContext = createContext<any>(null);

interface ProjectStatusRecordType {
    // Downloaded Record from AirTable
    FIELD_NAME: string;
    NOTES: string;
    SECTION: string;
    VALUE: string;
}

interface ProjectStatusDataType {
    // Output after cleaning
    current_step: number;
    steps: { step_number: number; step_name: string; notes: string }[];
}

const defaultProjectStatusData: ProjectStatusDataType = {
    current_step: 0,
    steps: [],
};

function extractFieldData(responseData: AirTableRecordType[]): ProjectStatusDataType {
    // Get only the STATUS records
    const statusRecords = responseData.filter((item: AirTableRecordType) => item.fields.SECTION === 'CERT_STATUS');

    // Get the field data
    const statusData: ProjectStatusRecordType[] = statusRecords.map((item: AirTableRecordType) => {
        return {
            FIELD_NAME: item.fields.FIELD_NAME || '',
            NOTES: item.fields.NOTES || '',
            SECTION: item.fields.SECTION || '',
            VALUE: item.fields.VALUE || '',
        };
    });

    // Get the records with 'STEP_' in FIELD_NAME
    const stepFields: ProjectStatusRecordType[] = statusData.filter((item: ProjectStatusRecordType) =>
        item.FIELD_NAME.includes('STEP_')
    );

    const newStepFields = stepFields.map(s => {
        return {
            step_number: Number(s.FIELD_NAME.replace('STEP_', '')),
            step_name: s.VALUE,
            notes: s.NOTES || '',
        };
    });

    // Get the current-status record
    const currentStatusField: ProjectStatusRecordType[] = statusData.filter((item: ProjectStatusRecordType) =>
        item.FIELD_NAME.includes('CURRENT_STATUS')
    );

    // Order the stepFields by their FIELD_NAME (alphabetically)
    const stepsInOrder = newStepFields.sort((a, b) => {
        return a.step_number - b.step_number;
    });

    // Package the data for output
    return { current_step: Number(currentStatusField[0].VALUE), steps: stepsInOrder };
}

export const ProjectStatusDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const [showModal, setShowModal] = useState(false);
    const [statusData, setStatusData] = useState<ProjectStatusDataType>(defaultProjectStatusData);

    // Fetch the Project Status Data
    useEffect(() => {
        const fetchProjectStatusData = async () => {
            const response: AirTableRecordType[] | null = await getWithAlert(`air_table/config/${projectId}`);

            if (response) {
                setStatusData(extractFieldData(response));
            } else {
                console.log(`Failed to download Project-Status Data for project: {projectId}`);
            }
        };

        try {
            setShowModal(true);
            console.log(`showModal 1=${showModal}`);
            fetchProjectStatusData();
        } catch (error) {
            const msg = `Failed to fetch project data. Please try again later. ${error}`;
            alert(msg);
            console.error(msg);
        } finally {
            setShowModal(false);
            console.log(`showModal 3=${showModal}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <ProjectStatusDataContext.Provider value={{ projectData: statusData, showModal }}>
            {children}
        </ProjectStatusDataContext.Provider>
    );
};

export const useProjectStatusData = () => {
    const context = useContext<{ projectData: ProjectStatusDataType; showModal: boolean } | null>(
        ProjectStatusDataContext
    );
    if (!context) {
        throw new Error('useProjectData must be used within a ProjectDataProvider');
    }
    return context;
};
