// The App can be in many 'states'. Each State will mount an arbitrary number of 
// event handlers, and visibility settings when activated. The AppState class
// will also unmount these event-handlers and visibility settings when the State is
// deactivated.

export enum appVizStateTypeEnum {
    None = 0,
    Geometry = 1,
    SpaceFloors = 2,
    Spaces = 3,
    SunPath = 4,
    Ventilation = 5,
    HotWaterPiping = 6,
}

type EventHandlerFunction = (event: any) => void;
type MountHandlerFunction = () => void;
type DismountHandlerFunction = () => void;

export class VizState {
    vizState: appVizStateTypeEnum;
    eventHandlers: { [event: string]: EventHandlerFunction } = {};
    mountHandlers: { [event: string]: MountHandlerFunction } = {};
    dismountHandlers: { [event: string]: DismountHandlerFunction } = {};

    constructor(vizState: appVizStateTypeEnum) {
        this.vizState = vizState;
    }


    addEventHandler(event: string, handler: EventHandlerFunction) {
        // All these will get added when the State is switched 'on'
        // They will all get removed when the State is switched 'off'
        this.eventHandlers[event] = handler;
    }
    addMountHandler(event: string, handler: MountHandlerFunction) {
        // All these will run when the State is switched 'on'
        this.mountHandlers[event] = handler;
    }
    addDismountHandler(event: string, handler: DismountHandlerFunction) {
        // All these will run when the State is switched 'off'
        this.dismountHandlers[event] = handler;
    }
}

export const vizStates: { [key: number]: VizState } = {
    0: new VizState(appVizStateTypeEnum.None),
    1: new VizState(appVizStateTypeEnum.Geometry),
    2: new VizState(appVizStateTypeEnum.SpaceFloors),
    3: new VizState(appVizStateTypeEnum.Spaces),
    4: new VizState(appVizStateTypeEnum.SunPath),
    5: new VizState(appVizStateTypeEnum.Ventilation),
    6: new VizState(appVizStateTypeEnum.HotWaterPiping),
};

export function addVizStateEventHandler(appVizState: number, eventName: string, callbackFunction: EventHandlerFunction) {
    vizStates[appVizState].addEventHandler(eventName, callbackFunction);
}

export function addVizStateMountHandler(appVizState: number, eventName: string, callbackFunction: MountHandlerFunction) {
    vizStates[appVizState].addMountHandler(eventName, callbackFunction);
}

export function addVizStateDismountHandler(appVizState: number, eventName: string, callbackFunction: DismountHandlerFunction) {
    vizStates[appVizState].addDismountHandler(eventName, callbackFunction);
}
