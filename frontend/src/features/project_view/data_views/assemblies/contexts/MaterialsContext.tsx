import React, { createContext, useContext } from "react";
import { Material } from "../types/Material";
import { useLoadMaterials } from "./MaterialsContext.Hooks";


interface MaterialsContextType {
    materials: Material[];
    isLoadingMaterials: boolean;
}


const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);


/**
 * MaterialsProvider is a React context provider component that supplies
 * materials data and loading state to its child components.
 *
 * This component uses the `useLoadMaterials` hook to fetch the materials
 * and their loading status, and provides these values through the
 * `MaterialsContext` to any descendant components that consume the context.
 *
 * @param children - The child components that will have access to the
 * context values provided by MaterialsContext.
 *
 * @returns A context provider wrapping the children with materials data
 * and loading state.
 */
export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { materials, isLoadingMaterials } = useLoadMaterials();

    return (
        <MaterialsContext.Provider value={{ materials, isLoadingMaterials }}>
            {children}
        </MaterialsContext.Provider>
    );
};


/**
 * Custom hook to access the `MaterialsContext`.
 *
 * This hook provides access to the `MaterialsContext` value, ensuring that it is
 * used within a `MaterialsProvider`. If the hook is called outside of a `MaterialsProvider`,
 * an error will be thrown.
 *
 * @returns {MaterialsContextType} The current value of the `MaterialsContext`.
 * @throws {Error} If the hook is used outside of a `MaterialsProvider`.
 */
export const useMaterials = (): MaterialsContextType => {
    const context = useContext(MaterialsContext);
    if (!context) {
        throw new Error("useMaterials must be used within a MaterialsProvider");
    }
    return context;
};