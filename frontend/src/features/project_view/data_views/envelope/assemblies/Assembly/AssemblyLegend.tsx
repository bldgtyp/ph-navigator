import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { useUnitConversion } from '../../../../_hooks/useUnitConversion';
import { convertArgbToRgba, MaterialType } from '../../_types/Material';
import { AssemblyType } from '../../_types/Assembly';
import { Unit } from '../../../../../../formatters/Unit.ConversionFactors';

const getUniqueMaterials = (assembly: AssemblyType): MaterialType[] => {
    const materialMap = new Map<string, MaterialType>();

    assembly.layers.forEach(layer => {
        layer.segments.forEach(segment => {
            const material = segment.material;
            if (!materialMap.has(material.id)) {
                materialMap.set(material.id, material);
            }
        });
    });

    return Array.from(materialMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const formatValueOrPlaceholder = (
    value: number | undefined | null,
    siUnit: Unit,
    ipUnit: Unit,
    decimals: number,
    formatter: (value: number | null | undefined, si: Unit, ip: Unit, d: number) => string
): string => {
    if (value === undefined || value === null || value === 0.0) return '--';
    return formatter(value, siUnit, ipUnit, decimals);
};

const ColorSwatch: React.FC<{ color: string; label: string }> = ({ color, label }) => {
    return (
        <Box
            sx={{
                width: 24,
                height: 24,
                borderRadius: '4px',
                border: '1px solid #ccc',
                backgroundColor: color,
            }}
            title={label}
            aria-label={label}
        />
    );
};

const AssemblyLegend: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();
    const materials = getUniqueMaterials(assembly);

    if (!materials.length) {
        return null;
    }

    const valueHeader = unitSystem === 'SI' ? 'Conductivity [W/m-K]' : 'Resistivity [R/inch]';

    return (
        <Box sx={{ mt: 3, width: '60%', mx: 'auto' }}>
            <Table size="small" aria-label="Assembly materials legend">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ width: 48 }}>Color</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell align="right">{valueHeader}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {materials.map(material => (
                        <TableRow key={material.id} hover>
                            <TableCell>
                                <ColorSwatch color={convertArgbToRgba(material.argb_color)} label={material.name} />
                            </TableCell>
                            <TableCell>{material.name}</TableCell>
                            <TableCell align="right">
                                {formatValueOrPlaceholder(
                                    material.conductivity_w_mk,
                                    'w/mk',
                                    'hr-ft2-F/btu-in',
                                    3,
                                    valueInCurrentUnitSystemWithDecimal
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
};

export default AssemblyLegend;
