import { ToolState, toolStates } from '../states/ToolState';
import { createContext, useContext, useReducer } from 'react';

// -- useReducer instead of useState so that THREE.js works
const setAppToolStateReducer = (_appToolState: ToolState, _appToolStateNumber: number) => {
    return toolStates[_appToolStateNumber]
}

// --
const defaultAppToolState = { appToolState: toolStates[0], dispatch: () => 0 }
type AppToolStateContextType = { appToolState: ToolState, dispatch: React.Dispatch<number> }
export const AppToolStateContext = createContext<AppToolStateContextType>(defaultAppToolState)

// --
export function AppToolStateContextProvider({ children }: any) {
    const [_appToolState, _appToolStateDispatch] = useReducer(setAppToolStateReducer, toolStates[0])

    return (
        <AppToolStateContext.Provider value={{ appToolState: _appToolState, dispatch: _appToolStateDispatch }}>
            {children}
        </AppToolStateContext.Provider>
    );
}

// -- Child components should consume the context through this hook
export function useAppToolStateContext() {
    const context = useContext(AppToolStateContext);
    return context;
}