import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Box, Modal } from '@mui/material';

import { getWithAlert } from '../../../../../api/getWithAlert';
import { AirTableRecordType } from '../../../../types/AirTableRecordType';
import DataViewPage from '../../_components/DataViewPage';
import CertificationStatus from './CertificationStatus';
import ContentBlock from '../../_components/ContentBlock';

function flattenData(d: AirTableRecordType[]): any {
    const flatData: Record<string, string | undefined> = {};
    d.forEach(item => {
        if (item.fields !== undefined && item.fields.FIELD_NAME !== undefined) {
            flatData[item.fields.FIELD_NAME] = item.fields.VALUE;
        }
    });
    return flatData;
}

const ProjectCertification: React.FC = () => {
    const { projectId } = useParams();
    const [showModal, setShowModal] = useState(false);
    const [certStatusData, setCertStatusData] = useState({});

    useEffect(() => {
        // Show modal if loading takes longer than 1s
        const timerId: NodeJS.Timeout = setTimeout(() => {
            setShowModal(true);
        }, 1000);

        const fetchProjectData = async () => {
            const d: any = await getWithAlert(`air_table/config/${projectId}`);

            // handle the fetched data
            setCertStatusData(flattenData(d.filter((item: any) => item.fields.SECTION === 'CERT_STATUS')));

            // Cleanup
            clearTimeout(timerId);
            setShowModal(false);
        };

        fetchProjectData();
    }, [projectId]);

    return (
        <>
            {showModal ? (
                <Modal open={showModal}>
                    <Box className="modal-box-loading">Loading Project Data...</Box>
                </Modal>
            ) : null}
            <DataViewPage>
                <ContentBlock>
                    <CertificationStatus statusData={certStatusData} />
                </ContentBlock>
            </DataViewPage>
        </>
    );
};

export default ProjectCertification;
