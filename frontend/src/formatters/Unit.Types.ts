// Define all possible unit categories
type UnitCategory =
    | 'length'
// | 'area'
// | 'volume'
// | 'temperature'
// | 'pressure'
// | 'thermal'
// | 'energy';

type LengthUnit = 'mm' | 'in'
// export type AreaUnit = 'mm2' | 'cm2' | 'm2' | 'km2' | 'in2' | 'ft2' | 'yd2' | 'acre';
// export type VolumeUnit = 'mm3' | 'cm3' | 'm3' | 'in3' | 'ft3' | 'gal';
// export type TemperatureUnit = 'C' | 'F' | 'K';
// export type PressureUnit = 'Pa' | 'kPa' | 'MPa' | 'psi' | 'bar' | 'atm';
// export type ThermalUnit = 'W/m2K' | 'Btu/h·ft²·°F';
// export type EnergyUnit = 'J' | 'kJ' | 'kWh' | 'Btu';

export type Unit =
    | LengthUnit
// | AreaUnit
// | VolumeUnit
// | TemperatureUnit
// | PressureUnit
// | ThermalUnit
// | EnergyUnit;
