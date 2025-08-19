import { useMemo } from 'react';
import { useUnitConversion } from '../../../../_hooks/useUnitConversion';

import { ValueAsDecimal } from '../../../../../../formatters/ValueAsDecimal';
import { CheckboxForDatasheet } from '../../../_components/CheckboxForDatasheet';
import { TooltipHeader } from '../../../_components/TooltipHeader';
import { TooltipWithComment } from '../../../_components/TooltipWithComment';
import { LinkIconWithDefault } from '../../../_components/LinkIconWithDefault';

export function useGlazingColumns(): any {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    const uValueHeader = unitSystem === 'SI' ? 'U-Value [W/m²K]' : 'U-Value [Btu/h·ft²·°F]'; // label

    return useMemo(
        () => [
            { field: 'manufacturer', headerName: 'Manuf' },
            { field: 'brand', headerName: 'Brand' },
            {
                field: 'u_value_w_m2k',
                headerName: uValueHeader,
                renderCell: (params: any) => {
                    const siVal = params.row.u_value_w_m2k;
                    const display = valueInCurrentUnitSystemWithDecimal(
                        siVal,
                        'w/m2k', // SI unit enum
                        'btu/hr-ft2-F', // IP unit enum (adjust to yours)
                        2
                    );
                    return <span>{display}</span>;
                },
            },
            {
                field: 'g_value',
                headerName: 'g-Value [%]',
                renderCell: (params: any) => ValueAsDecimal(params, 2), // dimensionless; no unit swap
            },
            {
                field: 'datasheet_url',
                headerName: 'Data Sheet',
                renderCell: (p: any) =>
                    CheckboxForDatasheet({ value: [{ id: p.row.id, url: p.row.datasheet_url, required: true }] }),
                renderHeader: (p: any) =>
                    TooltipHeader({
                        params: p,
                        title: "Do we have a PDF data-sheet with the product's performance values? Yes/No",
                    }),
            },
            {
                field: 'comments',
                headerName: 'Notes',
                renderCell: (p: any) => TooltipWithComment({ row: { NOTES: p.row.comments } }),
            },
            {
                field: 'link',
                headerName: 'Link',
                renderCell: (p: any) => LinkIconWithDefault({ value: p.row.link }),
            },
        ],
        [uValueHeader, valueInCurrentUnitSystemWithDecimal]
    );
}
