import { ApertureElementFrameType, ApertureElementGlazingType, ApertureElementType, ApertureType } from '../types';

export type FramePosition = 'top' | 'right' | 'bottom' | 'left';

export interface GlazingRowProps {
    rowIndex: number;
    aperture: ApertureType;
    element: ApertureElementType;
    glazing: ApertureElementGlazingType | null;
}

export interface FrameRowProps {
    rowIndex: number;
    aperture: ApertureType;
    element: ApertureElementType;
    position: FramePosition;
}

export interface TableGroupProps {
    aperture: ApertureType;
    element: ApertureElementType;
    isSelected: boolean;
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

export interface FrameSelectorProps {
    aperture: ApertureType;
    element: ApertureElementType;
    selectedFrame: ApertureElementFrameType | null;
    isLoading?: boolean;
    position: FramePosition;
}

export interface GlazingSelectorProps {
    aperture: ApertureType;
    element: ApertureElementType;
    selectedGlazing: ApertureElementGlazingType | null;
    isLoading?: boolean;
}
