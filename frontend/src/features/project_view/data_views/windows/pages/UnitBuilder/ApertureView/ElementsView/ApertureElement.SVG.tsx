import { useMemo, useState } from 'react';
import { Tooltip } from '@mui/material';

import { ApertureElementSVGProps } from './types';
import { OperationSymbol } from './OperationSymbols';

type FrameSide = 'top' | 'right' | 'bottom' | 'left';

const ApertureElementSVG: React.FC<ApertureElementSVGProps> = ({
    height,
    width,
    element,
    scaleFactor,
    isInsideView,
}) => {
    const [hoveredSide, setHoveredSide] = useState<FrameSide | null>(null);

    const frameData = useMemo(
        () =>
            isInsideView
                ? {
                      top: element.frames.top,
                      right: element.frames.left,
                      bottom: element.frames.bottom,
                      left: element.frames.right,
                  }
                : element.frames,
        [element.frames, isInsideView]
    );

    // Get frame widths from element data, with 100mm default if null
    const defaultFrameWidth = 100; // mm
    const topFrameWidth = frameData.top.frame_type.width_mm ?? defaultFrameWidth;
    const rightFrameWidth = frameData.right.frame_type.width_mm ?? defaultFrameWidth;
    const bottomFrameWidth = frameData.bottom.frame_type.width_mm ?? defaultFrameWidth;
    const leftFrameWidth = frameData.left.frame_type.width_mm ?? defaultFrameWidth;

    const scaledFrameWidths = {
        top: topFrameWidth * scaleFactor,
        right: rightFrameWidth * scaleFactor,
        bottom: bottomFrameWidth * scaleFactor,
        left: leftFrameWidth * scaleFactor,
    };

    const frameNames = useMemo(
        () => ({
            top: frameData.top.frame_type.name,
            right: frameData.right.frame_type.name,
            bottom: frameData.bottom.frame_type.name,
            left: frameData.left.frame_type.name,
        }),
        [frameData]
    );

    const getFill = (side: FrameSide) => (hoveredSide === side ? 'rgba(25, 118, 210, 0.1)' : '#fff');
    const getStroke = (side: FrameSide) => (hoveredSide === side ? 'var(--primary-color)' : '#000');

    const frameRects = [
        {
            side: 'right' as const,
            placement: 'right' as const,
            x: width - scaledFrameWidths.right,
            y: 0,
            w: scaledFrameWidths.right,
            h: height,
        },
        {
            side: 'left' as const,
            placement: 'left' as const,
            x: 0,
            y: 0,
            w: scaledFrameWidths.left,
            h: height,
        },
        {
            side: 'top' as const,
            placement: 'top' as const,
            x: 0,
            y: 0,
            w: width,
            h: scaledFrameWidths.top,
        },
        {
            side: 'bottom' as const,
            placement: 'bottom' as const,
            x: 0,
            y: height - scaledFrameWidths.bottom,
            w: width,
            h: scaledFrameWidths.bottom,
        },
    ];

    // Calculate glazing area (inside the frames) for operation symbols
    const glazingArea = useMemo(
        () => ({
            x: scaledFrameWidths.left,
            y: scaledFrameWidths.top,
            width: width - scaledFrameWidths.left - scaledFrameWidths.right,
            height: height - scaledFrameWidths.top - scaledFrameWidths.bottom,
        }),
        [scaledFrameWidths, width, height]
    );

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {frameRects.map(({ side, placement, x, y, w, h }) => (
                <Tooltip key={side} title={frameNames[side]} placement={placement} arrow enterDelay={250}>
                    <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={getFill(side)}
                        stroke={getStroke(side)}
                        onMouseEnter={() => setHoveredSide(side)}
                        onMouseLeave={() => setHoveredSide(null)}
                    />
                </Tooltip>
            ))}
            {element.operation && (
                <OperationSymbol operation={element.operation} glazingArea={glazingArea} isInsideView={isInsideView} />
            )}
        </svg>
    );
};

export default ApertureElementSVG;
