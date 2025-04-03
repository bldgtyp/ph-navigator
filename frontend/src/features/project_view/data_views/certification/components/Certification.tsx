import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Box, Modal } from "@mui/material";

import { fetchWithAlert } from "../../../../../api/fetchData";
import { AirTableRecordType } from "../../../../types/AirTableRecord";
import DataViewPage from "../../shared/components/DataViewPage";
import CertificationStatus from "./CertificationStatus";
import ContentBlock from "../../shared/components/ContentBlock";
import { CertificationDataType, defaultCertificationData } from "../../types/CertificationData";

function flattenData(d: AirTableRecordType[]): any {
    const flatData: Record<string, string | undefined> = {};
    d.forEach((item) => {
        if (item.fields !== undefined && item.fields.FIELD_NAME !== undefined) {
            flatData[item.fields.FIELD_NAME] = item.fields.VALUE;
        }
    });
    return flatData;
}


export default function ProjectCertification(params: any) {
    const { projectId } = useParams();
    const [showModal, setShowModal] = useState(false);
    const [certStatusData, setCertStatusData] = useState({});
    const [certLinkData, setCertLinkData] = useState({});
    const [certProjectData, setCertProjectData] = useState<CertificationDataType>(defaultCertificationData);

    useEffect(() => {
        // Show modal if loading takes longer than 1s
        const timerId: NodeJS.Timeout = setTimeout(() => {
            setShowModal(true);
        }, 1000);

        const fetchProjectData = async () => {
            const d: any = await fetchWithAlert(`air_table/${projectId}/config`);

            // handle the fetched data
            setCertStatusData(flattenData(d.filter((item: any) => item.fields.SECTION === "CERT_STATUS")));
            setCertLinkData(flattenData(d.filter((item: any) => item.fields.SECTION === "LINKS")));
            setCertProjectData(flattenData(d.filter((item: any) => item.fields.SECTION === "PROJ_DATA")));

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
                    <CertificationStatus
                        statusData={certStatusData}
                        linkData={certLinkData}
                        projData={certProjectData}
                    />
                </ContentBlock>
            </DataViewPage>
        </>
    )
}