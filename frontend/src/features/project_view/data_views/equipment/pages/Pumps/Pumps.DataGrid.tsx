import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../_hooks/useLoadDataGridFromAirTable';
import { PumpsRecord } from './Pumps.Types';
import tableFields from './Pumps.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import pump_nameplate from './_assets/pump_nameplate.jpg';
import RequiredSitePhotosGrid from '../../../_components/RequiredSitePhoto.Grid';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Required Site Photos listing
const requiredSitePhotos = [
    {
        src: pump_nameplate,
        captions: ['The Pump with close-up showing name-plate and manufacture / model numbers.'],
    },
];

// ----------------------------------------------------------------------------
const PumpsDataGrid: React.FC = () => {
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<PumpsRecord>(defaultRow, 'pumps', projectId);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <>
            <ContentBlock>
                <LoadingModal showModal={showModal} />
                <ContentBlockHeader text="Pumps" />
                <StyledDataGrid rows={rowData} columns={columns} />
            </ContentBlock>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the Pumps listed above:"
                    requiredPhotos={requiredSitePhotos}
                />
            </ContentBlock>
        </>
    );
};

export default PumpsDataGrid;
