import { ApertureElementSVGProps } from './types';

const ApertureElementSVG: React.FC<ApertureElementSVGProps> = ({ height, width }) => {
    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <rect x={width - 10} y="0" width="10" height={height} fill="white" stroke="black" /> {/* Right */}
            <rect x="0" y="0" width="10" height={height} fill="white" stroke="black" /> {/* Left */}
            <rect x="0" y="0" width={width} height="10" fill="white" stroke="black" /> {/* Top */}
            <rect x="0" y={height - 10} width={width} height="10" fill="white" stroke="black" /> {/* Bottom */}
        </svg>
    );
};

export default ApertureElementSVG;
