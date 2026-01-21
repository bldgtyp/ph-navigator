import { VizState, vizStates } from '../states/VizState';
import { createContext, useContext, useReducer } from 'react';

// -- useReducer instead of useState so that THREE.js works
const setAppVizStateReducer = (_appVizState: VizState, _appVizStateNumber: number) => {
    return vizStates[_appVizStateNumber];
};

// --
const defaultAppVizState = { appVizState: vizStates[1], dispatch: () => 1 };
type AppVizStateContextType = { appVizState: VizState; dispatch: React.Dispatch<number> };
export const AppVizStateContext = createContext<AppVizStateContextType>(defaultAppVizState);

// --
export function AppStateContextProvider({ children }: any) {
    const [_appVizState, _appStateDispatch] = useReducer(setAppVizStateReducer, vizStates[1]);

    return (
        <AppVizStateContext.Provider value={{ appVizState: _appVizState, dispatch: _appStateDispatch }}>
            {children}
        </AppVizStateContext.Provider>
    );
}

// -- Child components should consume the context through this hook
export function useAppVizStateContext() {
    const context = useContext(AppVizStateContext);
    return context;
}
