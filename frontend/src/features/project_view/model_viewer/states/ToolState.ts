// The App can be in many 'states'. Each State will mount an arbitrary number of 
// event handlers, and visibility settings when activated. The AppState class
// will also unmount these event-handlers and visibility settings when the State is
// deactivated.

export enum appToolStateTypeEnum {
    None = 0,
    Select = 1,
    Measure = 2,
    Comments = 3,
}

type EventHandlerFunction = (event: any) => void;
type MountHandlerFunction = () => void;
type DismountHandlerFunction = () => void;

export class ToolState {
    toolState: appToolStateTypeEnum;
    eventHandlers: { [event: string]: EventHandlerFunction } = {};
    mountHandlers: { [event: string]: MountHandlerFunction } = {};
    dismountHandlers: { [event: string]: DismountHandlerFunction } = {};

    constructor(toolState: appToolStateTypeEnum) {
        this.toolState = toolState;
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

export const toolStates: { [key: number]: ToolState } = {
    0: new ToolState(appToolStateTypeEnum.None),
    1: new ToolState(appToolStateTypeEnum.Select),
    2: new ToolState(appToolStateTypeEnum.Measure),
    3: new ToolState(appToolStateTypeEnum.Comments),
};

export function addToolStateEventHandler(appToolState: number, eventName: string, callbackFunction: EventHandlerFunction) {
    toolStates[appToolState].addEventHandler(eventName, callbackFunction);
}

export function addToolStateMountHandler(appToolState: number, eventName: string, callbackFunction: MountHandlerFunction) {
    toolStates[appToolState].addMountHandler(eventName, callbackFunction);
}

export function addToolStateDismountHandler(appToolState: number, eventName: string, callbackFunction: DismountHandlerFunction) {
    toolStates[appToolState].addDismountHandler(eventName, callbackFunction);
}
