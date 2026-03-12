import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useUnitSystem } from '../../../../../_contexts/UnitSystemContext';
import { formatValueForDisplay, parseDisplayUnitToMM } from './displayUnitConverter';

import type { DisplayUnit, IPDisplayUnit, SIDisplayUnit } from './types';

interface DisplayUnitContextType {
    activeDisplayUnit: DisplayUnit;
    displayUnitLabel: string;
    formatValue: (valueMM: number, decimals?: number) => string;
    parseToMM: (input: string) => number;
    setSIDisplayUnit: (unit: SIDisplayUnit) => void;
    setIPDisplayUnit: (unit: IPDisplayUnit) => void;
}

const SI_STORAGE_KEY = 'window_builder_si_display_unit';
const IP_STORAGE_KEY = 'window_builder_ip_display_unit';

const SI_UNITS: SIDisplayUnit[] = ['mm', 'cm', 'm'];
const IP_UNITS: IPDisplayUnit[] = ['in', 'ft', 'ft-in'];

function isValidSIUnit(value: string | null): value is SIDisplayUnit {
    return SI_UNITS.includes(value as SIDisplayUnit);
}

function isValidIPUnit(value: string | null): value is IPDisplayUnit {
    return IP_UNITS.includes(value as IPDisplayUnit);
}

function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore — localStorage unavailable or quota exceeded
    }
}

const DisplayUnitContext = createContext<DisplayUnitContextType | undefined>(undefined);

export const DisplayUnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { unitSystem } = useUnitSystem();

    const [siUnit, setSIUnitState] = useState<SIDisplayUnit>(() => {
        const stored = safeGetItem(SI_STORAGE_KEY);
        return isValidSIUnit(stored) ? stored : 'mm';
    });

    const [ipUnit, setIPUnitState] = useState<IPDisplayUnit>(() => {
        const stored = safeGetItem(IP_STORAGE_KEY);
        return isValidIPUnit(stored) ? stored : 'in';
    });

    useEffect(() => {
        safeSetItem(SI_STORAGE_KEY, siUnit);
    }, [siUnit]);

    useEffect(() => {
        safeSetItem(IP_STORAGE_KEY, ipUnit);
    }, [ipUnit]);

    const activeDisplayUnit = unitSystem === 'SI' ? siUnit : ipUnit;

    const formatValue = useCallback(
        (valueMM: number, decimals?: number) => formatValueForDisplay(valueMM, activeDisplayUnit, decimals),
        [activeDisplayUnit]
    );

    const parseToMM = useCallback(
        (input: string) => parseDisplayUnitToMM(input, activeDisplayUnit),
        [activeDisplayUnit]
    );

    const value = useMemo<DisplayUnitContextType>(
        () => ({
            activeDisplayUnit,
            displayUnitLabel: activeDisplayUnit,
            formatValue,
            parseToMM,
            setSIDisplayUnit: setSIUnitState,
            setIPDisplayUnit: setIPUnitState,
        }),
        [activeDisplayUnit, formatValue, parseToMM]
    );

    return <DisplayUnitContext.Provider value={value}>{children}</DisplayUnitContext.Provider>;
};

export const useDisplayUnit = (): DisplayUnitContextType => {
    const context = useContext(DisplayUnitContext);
    if (!context) {
        throw new Error('useDisplayUnit must be used within a DisplayUnitProvider');
    }
    return context;
};
