import { Box, Modal } from '@mui/material';
import DataViewPage from '../_components/DataViewPage';
import ContentBlocksContainer from '../_components/ContentBlocks.Container';
import ProjectStatusTimeline from './_components/ProjectStatusTimeline';
import { ProjectStatusDataProvider, useProjectStatusData } from './_contexts/ProjectDataContext';
import LoadingModal from '../_components/LoadingModal';

const ProjectStatusContent: React.FC = () => {
    const { showModal } = useProjectStatusData();

    return (
        <Box sx={{ alignContent: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {showModal ? (
                <Modal open={showModal}>
                    <Box className="modal-box-loading">Loading Project Data...</Box>
                </Modal>
            ) : null}
            <LoadingModal showModal={showModal} />
            <ProjectStatusTimeline />
            {/* <ProjectStatusDetailsTable /> */}
        </Box>
    );
};

const ProjectStatus: React.FC = () => {
    return (
        <DataViewPage>
            <ContentBlocksContainer>
                <ProjectStatusDataProvider>
                    <ProjectStatusContent />
                </ProjectStatusDataProvider>
            </ContentBlocksContainer>
        </DataViewPage>
    );
};

export default ProjectStatus;
