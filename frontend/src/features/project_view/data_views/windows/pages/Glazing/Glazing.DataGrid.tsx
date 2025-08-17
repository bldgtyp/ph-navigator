import React, { useMemo, useState } from 'react';

import { useApertures } from '../../_contexts/Aperture.Context';
import { useGlazingTypes } from '../../_contexts/GlazingTypes.Context';

import { generateGridColumns, generateDefaultRow } from '../../../_components/DataGridFunctions';
import LoadingModal from '../../../_components/LoadingModal';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import ContentBlock from '../../../_components/ContentBlock';
import tableFields from './Glazing.TableFields';
import StyledDataGrid from '../../../_styles/DataGrid';
import { ApertureType } from '../UnitBuilder/types';

// Create the columns object based on tableFields and then
// create an Array with a default single row, with all '-' cells.
// This will display while the data is being fetched
const columns = generateGridColumns(tableFields);
const defaultRow = generateDefaultRow(tableFields);

// Collect unique Glazing-Type IDs from the ApertureElements
const collectUniqueGlazingTypeIds = (apertures: ApertureType[]): Set<string> => {
    const ids = new Set<string>();
    for (const aperture of apertures) {
        for (const element of aperture.elements ?? []) {
            const glazing = element.glazing;
            if (!glazing) continue;
            ids.add(glazing.glazing_type.id);
        }
    }
    return ids;
};

const GlazingTypesDataGrid: React.FC = () => {
    const { apertures } = useApertures();
    const { glazingTypes } = useGlazingTypes();
    const [showModal, setShowModal] = useState(true);

    // ------------------------------------------------------------------------
    // Load in the table data from the Database
    const glazingData = useMemo(() => {
        if (!apertures.length || !glazingTypes.length) return defaultRow;

        const uniqueIds = collectUniqueGlazingTypeIds(apertures);
        if (uniqueIds.size === 0) return defaultRow;

        setShowModal(false);
        return glazingTypes
            .filter(gt => uniqueIds.has(gt.id))
            .slice() // copy before sort
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [apertures, glazingTypes]);

    // ------------------------------------------------------------------------
    // Update columns dynamically when rowData changes
    const adjustedColumns = useDynamicColumns(columns, glazingData, [
        'manufacturer',
        'brand',
        'u_value_w_m2k',
        'g_value',
        'comments',
    ]);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            <LoadingModal showModal={showModal} />
            <ContentBlockHeader text="Window & Door Glazing-Types" />
            <StyledDataGrid rows={glazingData} columns={adjustedColumns} />
        </ContentBlock>
    );
};

export default GlazingTypesDataGrid;
