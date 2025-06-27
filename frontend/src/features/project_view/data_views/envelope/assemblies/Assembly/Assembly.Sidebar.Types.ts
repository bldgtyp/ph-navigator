import { AssemblyType } from '../../_types/Assembly';

export interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    onAssemblyChange: (assemblyId: number) => void;
    onAddAssembly: () => void;
    onDeleteAssembly: (assemblyId: number) => void;
    onNameChange: (assemblyId: number, newName: string) => void;
}
