import { ApertureElementSVGProps } from './types';

const ApertureElementSVG: React.FC<ApertureElementSVGProps> = ({ height, width, element, scaleFactor }) => {
    // Get frame widths from element data, with 100mm default if null
    const defaultFrameWidth = 100; // mm
    const topFrameWidth = element.frames.top?.width_mm ?? defaultFrameWidth;
    const rightFrameWidth = element.frames.right?.width_mm ?? defaultFrameWidth;
    const bottomFrameWidth = element.frames.bottom?.width_mm ?? defaultFrameWidth;
    const leftFrameWidth = element.frames.left?.width_mm ?? defaultFrameWidth;

    // Apply scale factor to frame widths
    const scaledTopFrame = topFrameWidth * scaleFactor;
    const scaledRightFrame = rightFrameWidth * scaleFactor;
    const scaledBottomFrame = bottomFrameWidth * scaleFactor;
    const scaledLeftFrame = leftFrameWidth * scaleFactor;

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {/* Right frame */}
            <rect
                x={width - scaledRightFrame}
                y="0"
                width={scaledRightFrame}
                height={height}
                fill="white"
                stroke="black"
            />
            {/* Left frame */}
            <rect x="0" y="0" width={scaledLeftFrame} height={height} fill="white" stroke="black" />
            {/* Top frame */}
            <rect x="0" y="0" width={width} height={scaledTopFrame} fill="white" stroke="black" />
            {/* Bottom frame */}
            <rect
                x="0"
                y={height - scaledBottomFrame}
                width={width}
                height={scaledBottomFrame}
                fill="white"
                stroke="black"
            />
        </svg>
    );
};

export default ApertureElementSVG;
