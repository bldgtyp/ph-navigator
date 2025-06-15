import * as THREE from 'three';
import React, { useRef, useState, createContext, useContext } from 'react';

// --
export type SelectedObjectContextType = {
    selectedObjectState: THREE.Group | THREE.Object3D | null,
    setSelectedObjectState: React.Dispatch<React.SetStateAction<THREE.Group | THREE.Object3D | null>>,
    selectedObjectRef: React.MutableRefObject<THREE.Group | THREE.Object3D | null>,
}
export const SelectedObjectContext = createContext<SelectedObjectContextType | null>(null)

// --
export function SelectedObjectContextProvider({ children }: any) {
    // Note:
    // Need to use BOTH useState and useRef to manage the selected object state.
    // The useRef will not auto-update the react side panels, and the useState will not 
    // update in the 3D Scene, so it seems we need to have both?
    //
    // TODO: try and create a single setter function so that I don't mess it up all the time.
    //
    const _selectedObjectRef_ = useRef<THREE.Object3D | null>(null);
    const [_selectedObjectState_, _setSelectedObjectState_] = useState<any>(null)

    return (
        <SelectedObjectContext.Provider value={{
            selectedObjectState: _selectedObjectState_,
            setSelectedObjectState: _setSelectedObjectState_,
            selectedObjectRef: _selectedObjectRef_
        }}>
            {children}
        </SelectedObjectContext.Provider>
    );
}

// -- Child components should consume the context through this hook
export function useSelectedObjectContext() {
    const context = useContext(SelectedObjectContext);
    if (context === null) {
        throw new Error(
            'useSelectedObjectContext must be used within a SelectedObjectContextProvider'
        );
    }
    return context;
}