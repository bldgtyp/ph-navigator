import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../../model_viewer/_hooks/useLoadDataGridFromAirTable';
import { LightingRecord } from '../../types/Lighting';
import tableFields from './Lighting.TableFields';
import ContentBlock from '../../../_components/ContentBlock';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// ----------------------------------------------------------------------------
const LightingDataGrid: React.FC = () => {
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<LightingRecord>(
        defaultRow,
        'lighting_fixtures',
        projectId
    );

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            <LoadingModal showModal={showModal} />
            <ContentBlockHeader text="Light Fixtures" />
            <StyledDataGrid rows={rowData} columns={columns} />
        </ContentBlock>
    );
};

export default LightingDataGrid;
