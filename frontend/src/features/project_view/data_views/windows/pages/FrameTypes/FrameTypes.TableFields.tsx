import { useMemo } from 'react';
import { useUnitConversion } from '../../../../_hooks/useUnitConversion';

import { CheckboxForDatasheet } from '../../../_components/CheckboxForDatasheet';
import { LinkIconWithDefault } from '../../../_components/LinkIconWithDefault';
import { TooltipWithComment } from '../../../_components/TooltipWithComment';
import { TooltipHeader } from '../../../_components/TooltipHeader';

export function useFrameTypeColumns(): any {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    const uValueHeader = unitSystem === 'SI' ? 'U-Value [W/m²K]' : 'U-Value [Btu/h·ft²·°F]';
    const widthHeader = unitSystem === 'SI' ? 'Width [MM]' : 'Width [Inches]';
    const psiGHeader = unitSystem === 'SI' ? 'Psi-G [W/mk]' : 'Psi-G [Btu/h·ft·°F]';

    return useMemo(
        () => [
            { field: 'manufacturer', headerName: 'Manuf' },
            { field: 'brand', headerName: 'Brand' },
            { field: 'use', headerName: 'Use' },
            { field: 'operation', headerName: 'Operation' },
            { field: 'location', headerName: 'Location' },
            {
                field: 'u_value_w_m2k',
                headerName: uValueHeader,
                renderCell: (params: any) => {
                    const siVal = params.row.u_value_w_m2k;
                    const display = valueInCurrentUnitSystemWithDecimal(
                        siVal,
                        'w/m2k', // SI unit enum
                        'btu/hr-ft2-F', // IP unit
                        2
                    );
                    return <span>{display}</span>;
                },
            },
            {
                field: 'width_mm',
                headerName: widthHeader,
                renderCell: (params: any) => {
                    const siVal = params.row.width_mm;
                    const display = valueInCurrentUnitSystemWithDecimal(
                        siVal,
                        'mm', // SI unit
                        'in', // IP unit
                        2
                    );
                    return <span>{display}</span>;
                },
            },
            {
                field: 'psi_g_w_mk',
                headerName: psiGHeader,
                renderCell: (params: any) => {
                    const siVal = params.row.psi_g_w_mk;
                    const display = valueInCurrentUnitSystemWithDecimal(
                        siVal,
                        'w/mk', // SI unit
                        'btu/hr-ft-F', // IP unit
                        3
                    );
                    return <span>{display}</span>;
                },
            },
            {
                field: 'datasheet_url',
                headerName: 'Data Sheet',
                renderCell: (params: any) =>
                    CheckboxForDatasheet({
                        value: [{ id: params.row.id, url: params.row.datasheet_url, required: true }],
                    }),
                renderHeader: (params: any) =>
                    TooltipHeader({
                        params,
                        title: "Do we have a PDF data-sheet with the product's performance values? Yes/No",
                    }),
            },
            {
                field: 'comments',
                headerName: 'Notes',
                renderCell: (params: any) => TooltipWithComment({ row: { NOTES: params.row.comments } }),
            },
            {
                field: 'link',
                headerName: 'Link',
                renderCell: (params: any) => LinkIconWithDefault({ value: params.row.link }),
            },
        ],
        [uValueHeader, widthHeader, psiGHeader, valueInCurrentUnitSystemWithDecimal]
    );
}
