// A single label-value row for the Element Info Panel

import { useUnitConversion } from '../../../_hooks/useUnitConversion';
import { LightTooltip } from '../../styles/styled_components/LightTooltip';
import { FieldConfig } from './fieldConfigs';

type InfoFieldProps = {
    config: FieldConfig;
    userData: Record<string, any>;
};

// Get a value from userData using dot notation path (e.g., 'boundary_condition.type')
function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

export default function InfoField({ config, userData }: InfoFieldProps) {
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
    const rawValue = getNestedValue(userData, config.key);

    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    let displayValue: string;
    let unitLabel: string | undefined;

    if (config.units) {
        // Value needs unit conversion
        const decimals = config.decimals ?? 2;
        displayValue = valueInCurrentUnitSystemWithDecimal(rawValue, config.units.si, config.units.ip, decimals);
        unitLabel = unitSystem === 'SI' ? config.units.siLabel : config.units.ipLabel;
    } else if (config.decimals !== undefined) {
        // Numeric value without unit conversion
        const num = Number(rawValue);
        displayValue = isNaN(num) ? String(rawValue) : num.toFixed(config.decimals);
    } else {
        // Plain string value
        displayValue = String(rawValue);
    }

    const valueWithUnit = unitLabel ? `${displayValue} ${unitLabel}` : displayValue;

    return (
        <div className="info-field">
            <span className="info-field-label">
                {config.label}
                {config.tooltip && (
                    <LightTooltip title={config.tooltip} placement="top">
                        <span className="info-field-tooltip-icon">ⓘ</span>
                    </LightTooltip>
                )}
            </span>
            <span className="info-field-value">{valueWithUnit}</span>
        </div>
    );
}
