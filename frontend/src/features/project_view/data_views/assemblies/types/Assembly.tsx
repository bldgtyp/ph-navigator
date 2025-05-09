import { Layer } from "./Layer";

export interface Assembly {
    id: string;
    name: string;
    layers: Layer[];
}

export interface UseLoadAssembliesReturn {
    isLoadingAssemblies: boolean;
    assemblies: Assembly[];
}