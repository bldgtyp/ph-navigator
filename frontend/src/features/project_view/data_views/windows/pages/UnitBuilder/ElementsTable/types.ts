import {
    ApertureFrameType,
    ApertureElementGlazing,
    ApertureGlazingType,
    ApertureElementType,
    ApertureType,
} from '../types';

export type FramePosition = 'top' | 'right' | 'bottom' | 'left';

export interface GlazingRowProps {
    rowIndex: number;
    aperture: ApertureType;
    element: ApertureElementType;
    glazing: ApertureElementGlazing | null;
}

export interface FrameRowProps {
    rowIndex: number;
    aperture: ApertureType;
    element: ApertureElementType;
    position: FramePosition;
    label?: string;
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
    selectedFrameType: ApertureFrameType;
    isLoading?: boolean;
    position: FramePosition;
}

export interface GlazingSelectorProps {
    element: ApertureElementType;
    selectedGlazingType: ApertureGlazingType;
    isLoading?: boolean;
}
