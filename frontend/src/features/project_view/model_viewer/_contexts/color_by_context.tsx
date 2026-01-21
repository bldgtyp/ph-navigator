import { createContext, useContext, useState } from 'react';

// ColorBy attribute enum for selecting which attribute to color by
export enum ColorByAttribute {
    FaceType = 'faceType',
    Boundary = 'boundary',
}

// Context type definition
type ColorByContextType = {
    colorByAttribute: ColorByAttribute;
    setColorByAttribute: React.Dispatch<React.SetStateAction<ColorByAttribute>>;
};

// Default context value
const defaultColorByContext: ColorByContextType = {
    colorByAttribute: ColorByAttribute.FaceType,
    setColorByAttribute: () => {},
};

export const ColorByContext = createContext<ColorByContextType>(defaultColorByContext);

// Provider component
export function ColorByContextProvider({ children }: { children: React.ReactNode }) {
    const [colorByAttribute, setColorByAttribute] = useState<ColorByAttribute>(ColorByAttribute.FaceType);

    return (
        <ColorByContext.Provider value={{ colorByAttribute, setColorByAttribute }}>{children}</ColorByContext.Provider>
    );
}

// Hook for consuming the context
export function useColorByContext() {
    const context = useContext(ColorByContext);
    return context;
}
