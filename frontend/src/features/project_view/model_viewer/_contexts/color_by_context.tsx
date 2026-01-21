import { createContext, useContext, useState } from 'react';
import { ColorDefinition } from '../_constants/colorByColors';

// ColorBy attribute enum for selecting which attribute to color by
export enum ColorByAttribute {
    FaceType = 'faceType',
    Boundary = 'boundary',
    OpaqueConstruction = 'opaqueConstruction',
    ApertureConstruction = 'apertureConstruction',
}

// Context type definition
type ColorByContextType = {
    colorByAttribute: ColorByAttribute;
    setColorByAttribute: React.Dispatch<React.SetStateAction<ColorByAttribute>>;
    dynamicLegendItems: ColorDefinition[];
    setDynamicLegendItems: React.Dispatch<React.SetStateAction<ColorDefinition[]>>;
};

// Default context value
const defaultColorByContext: ColorByContextType = {
    colorByAttribute: ColorByAttribute.FaceType,
    setColorByAttribute: () => {},
    dynamicLegendItems: [],
    setDynamicLegendItems: () => {},
};

export const ColorByContext = createContext<ColorByContextType>(defaultColorByContext);

// Provider component
export function ColorByContextProvider({ children }: { children: React.ReactNode }) {
    const [colorByAttribute, setColorByAttribute] = useState<ColorByAttribute>(ColorByAttribute.FaceType);
    const [dynamicLegendItems, setDynamicLegendItems] = useState<ColorDefinition[]>([]);

    return (
        <ColorByContext.Provider
            value={{ colorByAttribute, setColorByAttribute, dynamicLegendItems, setDynamicLegendItems }}
        >
            {children}
        </ColorByContext.Provider>
    );
}

// Hook for consuming the context
export function useColorByContext() {
    const context = useContext(ColorByContext);
    return context;
}
