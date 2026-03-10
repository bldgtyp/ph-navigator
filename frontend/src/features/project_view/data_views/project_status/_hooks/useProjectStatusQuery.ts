import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchGet } from '../../../../../api/fetchApi';
import { queryKeys } from '../../../../../api/queryKeys';
import { AirTableRecordType } from '../../../../types/AirTableRecordType';

interface ProjectStatusRecordType {
    FIELD_NAME: string;
    NOTES: string;
    SECTION: string;
    VALUE: string;
}

export interface ProjectStatusDataType {
    current_step: number;
    steps: { step_number: number; step_name: string; notes: string }[];
}

const defaultProjectStatusData: ProjectStatusDataType = {
    current_step: 0,
    steps: [],
};

function extractFieldData(responseData: AirTableRecordType[]): ProjectStatusDataType {
    const statusRecords = responseData.filter((item: AirTableRecordType) => item.fields.SECTION === 'CERT_STATUS');

    const statusData: ProjectStatusRecordType[] = statusRecords.map((item: AirTableRecordType) => ({
        FIELD_NAME: item.fields.FIELD_NAME || '',
        NOTES: item.fields.NOTES || '',
        SECTION: item.fields.SECTION || '',
        VALUE: item.fields.VALUE || '',
    }));

    const stepFields = statusData.filter((item: ProjectStatusRecordType) => item.FIELD_NAME.includes('STEP_'));

    const newStepFields = stepFields.map(s => ({
        step_number: Number(s.FIELD_NAME.replace('STEP_', '')),
        step_name: s.VALUE,
        notes: s.NOTES || '',
    }));

    const currentStatusField = statusData.filter((item: ProjectStatusRecordType) =>
        item.FIELD_NAME.includes('CURRENT_STATUS')
    );

    const stepsInOrder = newStepFields.sort((a, b) => a.step_number - b.step_number);

    return { current_step: Number(currentStatusField[0].VALUE), steps: stepsInOrder };
}

export function useProjectStatusQuery() {
    const { projectId } = useParams();

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.projectStatus(projectId || ''),
        queryFn: () => fetchGet<AirTableRecordType[]>(`air_table/config/${projectId}`),
        enabled: !!projectId,
        select: extractFieldData,
    });

    return {
        projectData: data ?? defaultProjectStatusData,
        showModal: isLoading,
        error,
    };
}
