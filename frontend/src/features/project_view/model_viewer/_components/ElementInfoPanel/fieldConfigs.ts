// Configuration for which fields to display for each element type

import { Unit } from '../../../../../formatters/Unit.ConversionFactors';

export type FieldConfig = {
    key: string; // Path in userData (supports dot notation for nested fields)
    label: string; // Display label
    tooltip?: string; // Optional tooltip text shown on hover
    decimals?: number; // Decimal places for numeric values (default: 2)
    // Unit conversion configuration (if provided, value will be converted based on unit system)
    units?: {
        si: Unit; // SI unit type for conversion
        ip: Unit; // IP unit type for conversion
        siLabel: string; // Display label for SI (e.g., 'm²')
        ipLabel: string; // Display label for IP (e.g., 'ft²')
    };
};

export type SectionConfig = {
    title: string; // Section header text
    fields: FieldConfig[];
};

export type ElementTypeConfig = {
    title: string;
    fields: FieldConfig[];
    sections?: SectionConfig[]; // Optional additional sections
};

export const fieldConfigs: Record<string, ElementTypeConfig> = {
    faceMesh: {
        title: 'Opaque Surface',
        fields: [
            { key: 'display_name', label: 'Name' },
            { key: 'identifier', label: 'ID' },
            { key: 'face_type', label: 'Face Type' },
            { key: 'boundary_condition.type', label: 'Boundary' },
            {
                key: 'area',
                label: 'Area',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
        ],
        sections: [
            {
                title: 'Construction',
                fields: [
                    { key: 'properties.energy.construction.identifier', label: 'Name' },
                    { key: 'properties.energy.construction.type', label: 'Type' },
                    {
                        key: 'properties.energy.construction.u_factor',
                        label: 'U-Factor',
                        tooltip:
                            'Construction U-factor including standard resistances for air films. Includes interior and exterior air film resistance.',
                        decimals: 3,
                        units: { si: 'w/m2k', ip: 'btu/hr-ft2-F', siLabel: 'W/m²K', ipLabel: 'Btu/hr·ft²·°F' },
                    },
                    {
                        key: 'properties.energy.construction.r_factor',
                        label: 'R-Factor',
                        tooltip:
                            'Construction R-factor including standard resistances for air films. Includes interior and exterior air film resistance.',
                        decimals: 2,
                        units: { si: 'm2k/w', ip: 'hr-ft2-F/btu', siLabel: 'm²K/W', ipLabel: 'hr·ft²·°F/Btu' },
                    },
                ],
            },
        ],
    },
    apertureMeshFace: {
        title: 'Window',
        fields: [
            { key: 'display_name', label: 'Name' },
            { key: 'identifier', label: 'ID' },
            { key: 'face_type', label: 'Face Type' },
            { key: 'boundary_condition.type', label: 'Boundary' },
            {
                key: 'area',
                label: 'Area',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
        ],
        sections: [
            {
                title: 'Construction',
                fields: [
                    { key: 'properties.energy.construction.identifier', label: 'Name' },
                    { key: 'properties.energy.construction.type', label: 'Type' },
                    {
                        key: 'properties.energy.construction.u_factor',
                        label: 'U-Factor',
                        tooltip:
                            'Construction U-factor including standard resistances for air films. Includes interior and exterior air film resistance.',
                        decimals: 3,
                        units: { si: 'w/m2k', ip: 'btu/hr-ft2-F', siLabel: 'W/m²K', ipLabel: 'Btu/hr·ft²·°F' },
                    },
                ],
            },
        ],
    },
    spaceGroup: {
        title: 'Interior Space',
        fields: [
            { key: 'display_name', label: 'Name' },
            { key: 'identifier', label: 'ID' },
            { key: 'number', label: 'Number' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'wufi_type', label: 'WUFI Type' },
            {
                key: 'floor_area',
                label: 'Floor Area',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
            {
                key: 'weighted_floor_area',
                label: 'Weighted Area',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
            {
                key: 'net_volume',
                label: 'Net Volume',
                decimals: 2,
                units: { si: 'm3', ip: 'ft3', siLabel: 'm³', ipLabel: 'ft³' },
            },
            {
                key: 'avg_clear_height',
                label: 'Avg Height',
                decimals: 2,
                units: { si: 'm', ip: 'ft', siLabel: 'm', ipLabel: 'ft' },
            },
            { key: 'average_floor_weighting_factor', label: 'Avg Weighting Factor', decimals: 3 },
        ],
        sections: [
            {
                title: 'Ventilation',
                fields: [
                    {
                        key: 'properties.ph._v_sup',
                        label: 'Supply Air',
                        tooltip: 'Volume flow rate of supply air into the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                    {
                        key: 'properties.ph._v_eta',
                        label: 'Extract Air',
                        tooltip: 'Volume flow rate of extract air from the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                    {
                        key: 'properties.ph._v_tran',
                        label: 'Transfer Air',
                        tooltip: 'Volume flow rate of transfer air through the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                ],
            },
        ],
    },
    pipeSegmentLine: {
        title: 'Pipe',
        fields: [
            { key: 'identifier', label: 'ID' },
            { key: 'display_name', label: 'Name' },
        ],
    },
    ductSegmentLine: {
        title: 'Duct',
        fields: [
            { key: 'identifier', label: 'ID' },
            { key: 'display_name', label: 'Name' },
            {
                key: 'diameter',
                label: 'Diameter',
                decimals: 0,
                units: { si: 'mm', ip: 'in', siLabel: 'mm', ipLabel: 'in' },
            },
            {
                key: 'insulation_thickness',
                label: 'Insulation',
                decimals: 0,
                units: { si: 'mm', ip: 'in', siLabel: 'mm', ipLabel: 'in' },
            },
        ],
    },
    spaceFloorSegmentMeshFace: {
        title: 'Interior Floor',
        fields: [
            { key: 'display_name', label: 'Space' },
            { key: 'number', label: 'Number' },
            {
                key: 'weighting_factor',
                label: 'Weight',
                tooltip: 'Floor area weighting factor for Passive House calculations. 1.0 = fully conditioned space.',
                decimals: 2,
            },
            {
                key: 'floor_area',
                label: 'Floor Area',
                tooltip: 'Gross floor area of this floor segment',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
            {
                key: 'weighted_floor_area',
                label: 'Weighted Area',
                tooltip: 'Floor area multiplied by weighting factor. Used for Passive House TFA calculations.',
                decimals: 2,
                units: { si: 'm2', ip: 'ft2', siLabel: 'm²', ipLabel: 'ft²' },
            },
        ],
        sections: [
            {
                title: 'Ventilation',
                fields: [
                    {
                        key: '_v_sup',
                        label: 'Supply Air',
                        tooltip: 'Volume flow rate of supply air into the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                    {
                        key: '_v_eta',
                        label: 'Extract Air',
                        tooltip: 'Volume flow rate of extract air from the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                    {
                        key: '_v_tran',
                        label: 'Transfer Air',
                        tooltip: 'Volume flow rate of transfer air through the space',
                        decimals: 0,
                        units: { si: 'm3_hr', ip: 'cfm', siLabel: 'm³/h', ipLabel: 'CFM' },
                    },
                ],
            },
        ],
    },
};
