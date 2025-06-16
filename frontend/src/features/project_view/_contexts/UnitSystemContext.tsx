import React, { createContext, useContext, useState, useEffect } from 'react';

export type UnitSystem = 'SI' | 'IP';

interface UnitSystemContextType {
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => void;
    toggleUnitSystem: () => void;
}

const UnitSystemContext = createContext<UnitSystemContextType | undefined>(undefined);

export const UnitSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Load preference from localStorage, default to SI
    const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
        const savedSystem = localStorage.getItem('unitSystem');
        return savedSystem === 'SI' || savedSystem === 'IP' ? savedSystem : 'SI';
    });

    // Update localStorage when preference changes
    useEffect(() => {
        localStorage.setItem('unitSystem', unitSystem);
    }, [unitSystem]);

    // Toggle between SI and IP
    const toggleUnitSystem = () => {
        setUnitSystemState(current => (current === 'SI' ? 'IP' : 'SI'));
    };

    // Set unit system explicitly
    const setUnitSystem = (system: UnitSystem) => {
        setUnitSystemState(system);
    };

    return (
        <UnitSystemContext.Provider value={{ unitSystem, setUnitSystem, toggleUnitSystem }}>
            {children}
        </UnitSystemContext.Provider>
    );
};

// Custom hook to use the context
export const useUnitSystem = () => {
    const context = useContext(UnitSystemContext);
    if (context === undefined) {
        throw new Error('useUnitSystem must be used within a UnitSystemProvider');
    }
    return context;
};
