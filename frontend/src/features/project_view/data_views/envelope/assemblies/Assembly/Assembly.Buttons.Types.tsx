export interface AssemblyButtonProps {
    selectedAssemblyId: number | null;
    onFlipOrientation: (assemblyId: number) => void;
    onFlipLayers: (assemblyId: number) => void;
    onDuplicateAssembly: (assemblyId: number) => void;
}
