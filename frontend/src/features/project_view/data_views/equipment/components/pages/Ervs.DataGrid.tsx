import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../../model_viewer/_hooks/useLoadDataGridFromAirTable';
import { ErvRecord } from '../../types/Ervs';
import tableFields from './Ervs.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

const ErvDataGrid: React.FC = () => {
    // --------------------------------------------------------------------------
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<ErvRecord>(defaultRow, 'erv_units', projectId);

    // --------------------------------------------------------------------------
    // Update columns to fit the data
    const adjustedColumns = useDynamicColumns(columns, rowData, ['DISPLAY_NAME', 'PHOTOS', 'MODEL', 'MANUFACTURER']);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            <LoadingModal showModal={showModal} />
            <ContentBlockHeader text="Ventilation Equipment (H/ERV)" />
            <StyledDataGrid rows={rowData} columns={adjustedColumns} />
        </ContentBlock>
    );
};

export default ErvDataGrid;
