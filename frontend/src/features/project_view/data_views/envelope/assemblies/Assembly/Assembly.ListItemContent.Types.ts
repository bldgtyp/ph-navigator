import { AssemblyType } from '../../_types/Assembly';

export interface AssemblyListItemContentProps {
    assembly: AssemblyType;
    isSelected: boolean;
    showControls: boolean;
    onSelect: (id: number) => void;
    onEditName: (id: number, name: string) => void;
    onDelete: (id: number) => void;
}

export interface AssemblyControlsProps {
    assembly: AssemblyType;
    onEdit: (id: number, name: string) => void;
    onDelete: (id: number) => void;
}
