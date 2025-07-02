import React from 'react';
import { SashProps } from '../types';

const ApertureElementSVG: React.FC<SashProps> = ({ height, width }) => {
    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <rect x="0" y="0" width={width} height="10" fill="white" stroke="black" />
            <rect x={width - 10} y="0" width="10" height={height} fill="white" stroke="black" />
            <rect x="0" y={height - 10} width={width} height="10" fill="white" stroke="black" />
            <rect x="0" y="0" width="10" height={height} fill="white" stroke="black" />
        </svg>
    );
};

export default ApertureElementSVG;
