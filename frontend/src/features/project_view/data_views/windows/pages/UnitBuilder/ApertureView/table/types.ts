import { ApertureElementFrameType, ApertureElementGlazingType, ApertureElementType } from '../../types';

export interface TableRowProps {
    name: string;
}

export interface GlazingRowProps extends TableRowProps {
    glazing: ApertureElementGlazingType | null;
}

export interface FrameRowProps extends TableRowProps {
    frame: ApertureElementFrameType | null;
}

export interface TableGroupProps {
    element: ApertureElementType;
    isSelected: boolean;
    onFrameChange?: (
        framePosition: 'top' | 'right' | 'bottom' | 'left',
        frame: ApertureElementFrameType | null
    ) => void;
}

export interface TableHeaderCellProps {
    children: React.ReactNode;
    size: number;
}

export interface TableCellProps {
    children: React.ReactNode;
    size: number;
    className?: string;
}
