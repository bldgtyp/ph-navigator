import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../_hooks/useLoadDataGridFromAirTable';
import { ErvRecord } from './Ervs.Types';
import tableFields from './Ervs.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';
import RequiredSitePhotosGrid from '../../../_components/RequiredSitePhoto.Grid';
import erv_unit from './_assets/erv_unit.jpg';
import erv_plate from './_assets/erv_name_plate.jpg';
import erv_filters from './_assets/erv_filters.jpg';
import erv_insulation from './_assets/erv_insulation.jpg';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Required Site Photos listing
const requiredSitePhotos = [
    { src: erv_unit, captions: ['H/ERV Unit installed in the space.'] },
    { src: erv_plate, captions: ['H/ERV Nameplate showing manufacturer and model details.'] },
    { src: erv_filters, captions: ['H/ERV filters (intake and exhaust) with close-up showing filter grade.'] },
    {
        src: erv_insulation,
        captions: ['Ducting Insulation thickness and material (only on the ducts from the H/ERV to the exterior).'],
    },
];

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
        <>
            <ContentBlock>
                <LoadingModal showModal={showModal} />
                <ContentBlockHeader text="Ventilation Equipment (H/ERV)" />
                <StyledDataGrid rows={rowData} columns={adjustedColumns} />
            </ContentBlock>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the H/ERV units listed above:"
                    requiredPhotos={requiredSitePhotos}
                />
            </ContentBlock>
        </>
    );
};

export default ErvDataGrid;
