import { LayerType } from "./Layer";

export interface AssemblyType {
    id: number;
    name: string;
    layers: LayerType[];
}

export interface UseLoadAssembliesReturn {
    isLoadingAssemblies: boolean;
    assemblies: AssemblyType[];
}