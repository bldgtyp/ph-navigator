import { useFrameTypes } from '../../../_contexts/FrameType.Context';
import { useGlazingTypes } from '../../../_contexts/GlazingTypes.Context';

import { TableCell } from './TableCells';
import { FrameSelector } from './FrameTypeSelector';
import { GlazingSelector } from './GlazingTypeSelector';
import { GlazingRowProps, FrameRowProps } from './types';
import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';

export const GlazingRow: React.FC<GlazingRowProps> = ({ aperture, element, rowIndex }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
    const { isLoadingGlazingTypes } = useGlazingTypes();

    return (
        <>
            <TableCell size={2} className={rowClass}>
                <span>Glazing:</span>
                {/* <span>{name}:</span> */}
            </TableCell>
            <TableCell size={6} className={rowClass}>
                {/* <span>{glazing?.name || '-'}</span> */}
                <GlazingSelector
                    element={element}
                    selectedGlazingType={element.glazing.glazing_type}
                    isLoading={isLoadingGlazingTypes}
                />
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.glazing.glazing_type.u_value_w_m2k,
                        'w/m2k',
                        'btu/hr-ft2-F',
                        unitSystem === 'SI' ? 3 : 3
                    )}
                </span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>-</span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>{element.glazing.glazing_type.g_value || '-'}</span>
            </TableCell>
        </>
    );
};

export const FrameRow: React.FC<FrameRowProps> = ({ aperture, element, rowIndex, position, label }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
    const { isLoadingFrameTypes } = useFrameTypes();
    const displayLabel = label ?? `${position.charAt(0).toUpperCase()}${position.slice(1).toLowerCase()} Frame:`;

    return (
        <>
            <TableCell size={2} className={rowClass}>
                {displayLabel}
            </TableCell>
            <TableCell size={6} className={rowClass}>
                <FrameSelector
                    aperture={aperture}
                    element={element}
                    selectedFrameType={element.frames[position].frame_type}
                    isLoading={isLoadingFrameTypes}
                    position={position}
                />
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.frames[position].frame_type.u_value_w_m2k,
                        'w/m2k',
                        'btu/hr-ft2-F',
                        unitSystem === 'SI' ? 3 : 3
                    )}
                </span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.frames[position].frame_type.width_mm,
                        'mm',
                        'in',
                        unitSystem === 'SI' ? 1 : 1
                    )}
                </span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>-</span>
            </TableCell>
        </>
    );
};
