// Configuration for which fields to display for each element type

import { Unit } from '../../../../../formatters/Unit.ConversionFactors';

export type FieldConfig = {
    key: string; // Path in userData (supports dot notation for nested fields)
    label: string; // Display label
    decimals?: number; // Decimal places for numeric values (default: 2)
    // Unit conversion configuration (if provided, value will be converted based on unit system)
    units?: {
        si: Unit; // SI unit type for conversion
        ip: Unit; // IP unit type for conversion
        siLabel: string; // Display label for SI (e.g., 'm²')
        ipLabel: string; // Display label for IP (e.g., 'ft²')
    };
};

export type ElementTypeConfig = {
    title: string;
    fields: FieldConfig[];
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
};
