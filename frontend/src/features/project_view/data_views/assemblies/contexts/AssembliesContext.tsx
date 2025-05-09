import React, { createContext, useContext } from "react";
import { Assembly } from "../types/Assembly";
import { useLoadAssemblies } from "./AssembliesContext.Hooks";


interface AssembliesContextType {
    assemblies: Assembly[];
    isLoadingAssemblies: boolean;
}


const AssembliesContext = createContext<AssembliesContextType | undefined>(undefined);


/**
 * AssembliesProvider is a React context provider component that supplies
 * Assemblies data and loading state to its child components.
 *
 * This component uses the `useLoadAssemblies` hook to fetch the Assemblies
 * and their loading status, and provides these values through the
 * `AssembliesContext` to any descendant components that consume the context.
 *
 * @param children - The child components that will have access to the
 * context values provided by AssembliesContext.
 *
 * @returns A context provider wrapping the children with Assemblies data
 * and loading state.
 */
export const AssembliesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { assemblies, isLoadingAssemblies } = useLoadAssemblies();

    return (
        <AssembliesContext.Provider value={{ assemblies, isLoadingAssemblies }}>
            {children}
        </AssembliesContext.Provider>
    );
};


export const useAssemblies = (): AssembliesContextType => {
    const context = useContext(AssembliesContext);
    if (!context) {
        throw new Error("useAssemblies must be used within a MaterialsProvider");
    }
    return context;
};