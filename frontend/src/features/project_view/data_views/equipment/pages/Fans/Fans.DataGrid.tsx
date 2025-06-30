import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../../model_viewer/_hooks/useLoadDataGridFromAirTable';
import { FanRecord } from './Fans.Types';
import tableFields from './Fans.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import RequiredSitePhotosGrid from '../../../_components/RequiredSitePhoto.Grid';
import fan_installed from './_assets/fan_installed.jpg';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Required Site Photos listing
const requiredSitePhotos = [
    {
        src: fan_installed,
        captions: ['The Fan with a close-up showing name-plate and manufacture / model numbers.'],
    },
];

// ----------------------------------------------------------------------------
const FanDataGrid: React.FC = () => {
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<FanRecord>(defaultRow, 'fans', projectId);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <>
            <ContentBlock>
                <LoadingModal showModal={showModal} />
                <ContentBlockHeader text="Fans" />
                <StyledDataGrid rows={rowData} columns={columns} />
            </ContentBlock>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the Fans listed above:"
                    requiredPhotos={requiredSitePhotos}
                />
            </ContentBlock>
        </>
    );
};

export default FanDataGrid;
