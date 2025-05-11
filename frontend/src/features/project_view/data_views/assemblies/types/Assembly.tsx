import { LayerType } from "./Layer";

export interface AssemblyType {
    id: number;
    name: string;
    layers: LayerType[];
}

export interface UseLoadAssembliesReturn {
    isLoadingAssemblies: boolean;
    setIsLoadingAssemblies: React.Dispatch<React.SetStateAction<boolean>>;
    assemblies: AssemblyType[];
    setAssemblies: React.Dispatch<React.SetStateAction<AssemblyType[]>>;
}