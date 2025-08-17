import { useParams } from 'react-router-dom';
import StyledDataGrid from '../../../_styles/DataGrid';
import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import useLoadDataGridFromAirTable from '../../../_hooks/useLoadDataGridFromAirTable';
import React from 'react';
import { AppliancesRecord } from './Appliances.Types';
import tableFields from './Appliances.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import RequiredSitePhotosGrid from '../../../_components/RequiredSitePhoto.Grid';
import appliance_installed from './_assets/appliance_installed.jpg';
import appliance_nameplate from './_assets/appliance_nameplate.jpg';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Required Site Photos listing
const requiredSitePhotos = [
    {
        src: appliance_installed,
        captions: ['The appliance installed in the space.'],
    },
    {
        src: appliance_nameplate,
        captions: ['A close-up showing name-plate and manufacture / model numbers.'],
    },
];

// ----------------------------------------------------------------------------
const AppliancesDataGrid: React.FC = () => {
    // Load in the table data from the Database
    const { projectId } = useParams();
    const { showModal, rowData } = useLoadDataGridFromAirTable<AppliancesRecord>(defaultRow, 'appliances', projectId);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <>
            <ContentBlock>
                <LoadingModal showModal={showModal} />
                <ContentBlockHeader text="Appliances" />
                <StyledDataGrid rows={rowData} columns={columns} />
            </ContentBlock>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the Appliances listed above:"
                    requiredPhotos={requiredSitePhotos}
                />
            </ContentBlock>
        </>
    );
};

export default AppliancesDataGrid;
