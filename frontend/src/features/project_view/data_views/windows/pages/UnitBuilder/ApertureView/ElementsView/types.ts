import { ApertureElementType } from '../../types';

export interface ApertureElementSVGProps {
    height: number;
    width: number;
    element: ApertureElementType;
    scaleFactor: number;
}

export interface ApertureElementContainerProps {
    element: ApertureElementType;
    width: number;
    height: number;
    isSelected: boolean;
}
