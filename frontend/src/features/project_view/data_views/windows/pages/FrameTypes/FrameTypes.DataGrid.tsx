import { useMemo, useState } from 'react';

import { useApertures } from '../../_contexts/Aperture.Context';
import { useFrameTypes } from '../../_contexts/FrameType.Context';
import { useDynamicColumns } from '../../../_hooks/useDynamicColumns';

import { generateDefaultRow } from '../../../_components/DataGridFunctions';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import { useFrameTypeColumns } from './FrameTypes.TableFields';
import ContentBlock from '../../../_components/ContentBlock';
import { ApertureType } from '../UnitBuilder/types';
import StyledDataGrid from '../../../_styles/DataGrid';
import LoadingModal from '../../../_components/LoadingModal';

// Collect unique Frame-Type IDs from the ApertureElements
const collectUniqueFrameTypeIds = (apertures: ApertureType[]): Set<string> => {
    const ids = new Set<string>();
    for (const aperture of apertures) {
        for (const element of aperture.elements ?? []) {
            const frames = element.frames;
            if (!frames) continue;
            const sides = ['top', 'right', 'bottom', 'left'] as const;
            for (const side of sides) {
                const ft = frames[side]?.frame_type;
                if (ft?.id) ids.add(ft.id);
            }
        }
    }
    return ids;
};

const FrameTypesDataGrid: React.FC = () => {
    const { apertures } = useApertures();
    const { frameTypes } = useFrameTypes();

    // ------------------------------------------------------------------------
    // Build columns (dynamic headers / unit formatting) inside component
    const columns = useFrameTypeColumns();
    const defaultRow = useMemo(() => generateDefaultRow(columns), [columns]);

    // ------------------------------------------------------------------------
    // Load in the table data from the Database
    const { frameData, isLoaded } = useMemo(() => {
        if (!apertures.length || !frameTypes.length) return { frameData: defaultRow, isLoaded: false };

        const uniqueIds = collectUniqueFrameTypeIds(apertures);
        if (uniqueIds.size === 0) return { frameData: defaultRow, isLoaded: false };

        const data = frameTypes
            .filter(ft => uniqueIds.has(ft.id))
            .slice() // copy before sort
            .sort((a, b) => a.name.localeCompare(b.name));
        return { frameData: data, isLoaded: true };
    }, [apertures, frameTypes, defaultRow]);

    // ------------------------------------------------------------------------
    // Update columns dynamically when frameData changes
    const adjustedColumns = useDynamicColumns(columns, frameData, [
        'manufacturer',
        'brand',
        'use',
        'operation',
        'location',
        'u_value_w_m2k',
        'width_mm',
        'psi_g_w_mk',
        'comments',
    ]);

    // --------------------------------------------------------------------------
    // Render the component
    return (
        <ContentBlock>
            <LoadingModal showModal={!isLoaded} />
            <ContentBlockHeader text="Window & Door Frame-Types" />
            <StyledDataGrid rows={frameData} columns={adjustedColumns} />
        </ContentBlock>
    );
};

export default FrameTypesDataGrid;
