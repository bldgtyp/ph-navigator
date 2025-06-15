import * as THREE from 'three';
import React, { useRef, useState, createContext, useContext } from 'react';

// --
export type HoverObjectContextType = {
    hoverObjectState: THREE.Group | THREE.Object3D | null,
    setHoverObjectState: React.Dispatch<React.SetStateAction<THREE.Group | THREE.Object3D | null>>,
    hoverObjectRef: React.MutableRefObject<THREE.Group | THREE.Object3D | null>,
}
export const HoverObjectContext = createContext<HoverObjectContextType | null>(null)

// --
export function HoverObjectContextProvider({ children }: any) {
    // Note:
    // Need to use BOTH useState and useRef to manage the selected object state.
    // The useRef will not auto-update the react side panels, and the useState will not 
    // update in the 3D Scene, so it seems we need to have both?
    //
    // TODO: try and create a single setter function so that I don't mess it up all the time.
    //
    const _hoverObjectRef_ = useRef<THREE.Object3D | null>(null);
    const [_hoverObjectState_, _setHoverObjectState_] = useState<any>(null)

    return (
        <HoverObjectContext.Provider value={{
            hoverObjectState: _hoverObjectState_,
            setHoverObjectState: _setHoverObjectState_,
            hoverObjectRef: _hoverObjectRef_
        }}>
            {children}
        </HoverObjectContext.Provider>
    );
}

// -- Child components should consume the context through this hook
export function useHoverObjectContext() {
    const context = useContext(HoverObjectContext);
    if (context === null) {
        throw new Error(
            'useHoverObjectContext must be used within a HoverObjectContextProvider'
        );
    }
    return context;
}