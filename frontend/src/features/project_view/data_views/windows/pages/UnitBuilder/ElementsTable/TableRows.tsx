import { useFrameTypes } from './FrameType.Context';
import { useGlazingTypes } from './GlazingTypes.Context';

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
                    aperture={aperture}
                    element={element}
                    selectedGlazing={element.glazing}
                    isLoading={isLoadingGlazingTypes}
                />
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.glazing?.u_value_w_m2k,
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
                <span>{element.glazing?.g_value || '-'}</span>
            </TableCell>
        </>
    );
};

export const FrameRow: React.FC<FrameRowProps> = ({ aperture, element, rowIndex, position }) => {
    const rowClass = `table-row ${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
    const { isLoadingFrameTypes } = useFrameTypes();

    return (
        <>
            <TableCell size={2} className={rowClass}>
                {`${position.charAt(0).toUpperCase()}${position.slice(1).toLowerCase()} Frame:`}
            </TableCell>
            <TableCell size={6} className={rowClass}>
                <FrameSelector
                    aperture={aperture}
                    element={element}
                    selectedFrame={element.frames[position]}
                    isLoading={isLoadingFrameTypes}
                    position={position}
                />
            </TableCell>
            <TableCell size={2} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.frames[position]?.u_value_w_m2k,
                        'w/m2k',
                        'btu/hr-ft2-F',
                        unitSystem === 'SI' ? 3 : 3
                    )}
                </span>
            </TableCell>
            <TableCell size={1} className={rowClass}>
                <span>
                    {valueInCurrentUnitSystemWithDecimal(
                        element.frames[position]?.width_mm,
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
