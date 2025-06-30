import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../../model_viewer/_hooks/useLoadDataGridFromAirTable';
import { DHWTankRecord } from './HotWaterTanks.Types';
import tableFields from './HotWaterTanks.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import dhw_tank from './_assets/dhw_tank.jpg';
import dhw_pipe_insulation from './_assets/dhw_pipe_insulation.jpg';
import RequiredSitePhotosGrid from '../../../_components/RequiredSitePhoto.Grid';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Required Site Photos listing
const requiredSitePhotos = [
    {
        src: dhw_tank,
        captions: [
            'The Hot-Water tank(s) installed in the space, with close-up showing name-plate and manufacture / model numbers.',
        ],
    },
    {
        src: dhw_pipe_insulation,
        captions: [
            'Insulation thickness and material for all hot-water recirculation pipes, and all storm-water / roof-drainage pipes.',
        ],
    },
];

// ----------------------------------------------------------------------------
const HotWaterTanksDataGrid: React.FC = () => {
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<DHWTankRecord>(defaultRow, 'dhw_tanks', projectId);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <>
            <ContentBlock>
                <LoadingModal showModal={showModal} />
                <ContentBlockHeader text="Hot Water Tanks" />
                <StyledDataGrid rows={rowData} columns={columns} />
            </ContentBlock>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the Hot-Water Tanks listed above:"
                    requiredPhotos={requiredSitePhotos}
                />
            </ContentBlock>
        </>
    );
};

export default HotWaterTanksDataGrid;
