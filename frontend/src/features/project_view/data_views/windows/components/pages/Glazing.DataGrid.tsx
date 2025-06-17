import React from 'react';
import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../../model_viewer/_hooks/useLoadDataGridFromAirTable';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';
import tableFields from './Glazing.TableFields';
import { GlazingTypesRecord } from '../../types/Glazing';
import ContentBlock from '../../../_components/ContentBlock';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

const GlazingTypesDataGrid: React.FC = () => {
    // --------------------------------------------------------------------------
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<GlazingTypesRecord>(
        defaultRow,
        'WINDOW_GLAZING_TYPES',
        projectId
    );

    // --------------------------------------------------------------------------
    // Update columns dynamically when rowData changes
    const adjustedColumns = useDynamicColumns(columns, rowData, ['DISPLAY_NAME']);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            {' '}
            <LoadingModal showModal={showModal} />
            <ContentBlockHeader text="Window & Door Glazing Types" />
            <Box sx={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                <StyledDataGrid rows={rowData} columns={adjustedColumns} />
            </Box>
        </ContentBlock>
    );
};

export default GlazingTypesDataGrid;
