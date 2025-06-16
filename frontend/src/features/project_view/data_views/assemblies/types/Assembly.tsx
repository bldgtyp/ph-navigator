import { LayerType } from './Layer';

export interface AssemblyType {
    id: number;
    name: string;
    layers: LayerType[];
    orientation: 'first_layer_outside' | 'last_layer_outside';
}

export interface UseLoadAssembliesReturn {
    isLoadingAssemblies: boolean;
    setIsLoadingAssemblies: React.Dispatch<React.SetStateAction<boolean>>;
    assemblies: AssemblyType[];
    setAssemblies: React.Dispatch<React.SetStateAction<AssemblyType[]>>;
}
