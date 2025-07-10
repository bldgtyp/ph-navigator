import { ApertureElementType } from '../../types';

export interface ApertureElementSVGProps {
    height: number;
    width: number;
}

export interface ApertureElementContainerProps {
    element: ApertureElementType;
    width: number;
    height: number;
    isSelected: boolean;
}
