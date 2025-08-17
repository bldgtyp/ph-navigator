import React, { useMemo } from 'react';

import { useApertures } from '../../_contexts/Aperture.Context';
import { useGlazingTypes } from '../../_contexts/GlazingTypes.Context';

import { generateDefaultRow } from '../../../_components/DataGridFunctions';
import LoadingModal from '../../../_components/LoadingModal';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import ContentBlock from '../../../_components/ContentBlock';
import { useGlazingColumns } from './GlazingTypes.TableFields';
import StyledDataGrid from '../../../_styles/DataGrid';
import { ApertureType } from '../UnitBuilder/types';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';

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

    // ------------------------------------------------------------------------
    // Build columns (dynamic headers / unit formatting) inside component
    const columns = useGlazingColumns();
    const defaultRow = useMemo(() => generateDefaultRow(columns), [columns]);

    // ------------------------------------------------------------------------
    // Load in the table data from the Database
    const { glazingData, isLoaded } = useMemo(() => {
        if (!apertures.length || !glazingTypes.length) {
            return { glazingData: defaultRow, isLoaded: false };
        }
        const uniqueIds = collectUniqueGlazingTypeIds(apertures);
        if (uniqueIds.size === 0) {
            return { glazingData: defaultRow, isLoaded: false };
        }
        const data = glazingTypes
            .filter(gt => uniqueIds.has(gt.id))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
        return { glazingData: data, isLoaded: true };
    }, [apertures, glazingTypes, defaultRow]);

    // ------------------------------------------------------------------------
    // Update columns dynamically when rowData changes
    const adjustedColumns = useDynamicColumns(columns, glazingData, [
        'manufacturer',
        'brand',
        'u_value_w_m2k',
        'g_value',
        'comments',
    ]);

    // ------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            <LoadingModal showModal={!isLoaded} />
            <ContentBlockHeader text="Window & Door Glazing-Types" />
            <StyledDataGrid rows={glazingData} columns={adjustedColumns} />
        </ContentBlock>
    );
};

export default GlazingTypesDataGrid;
