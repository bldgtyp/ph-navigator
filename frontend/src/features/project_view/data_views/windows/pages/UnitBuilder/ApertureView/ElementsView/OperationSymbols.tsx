import { ElementOperation, OperationDirection } from '../../types';

interface GlazingArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface OperationSymbolProps {
    operation: ElementOperation;
    glazingArea: GlazingArea;
    isInsideView: boolean;
}

interface SwingSymbolProps {
    direction: OperationDirection;
    glazingArea: GlazingArea;
    isInsideView: boolean;
}

interface SlideArrowProps {
    direction: OperationDirection;
    glazingArea: GlazingArea;
    isInsideView: boolean;
}

const SYMBOL_COLOR = '#666';
const SYMBOL_STROKE_WIDTH = 1;

/**
 * Maps directions from exterior view to interior view (mirrors horizontally)
 */
const flipDirectionForInsideView = (direction: OperationDirection): OperationDirection => {
    if (direction === 'left') return 'right';
    if (direction === 'right') return 'left';
    return direction;
};

/**
 * SwingSymbol renders a pair of diagonal dashed lines from the hinge side to opposite corners.
 * The hinge is on the side specified by `direction`.
 */
const SwingSymbol: React.FC<SwingSymbolProps> = ({ direction, glazingArea, isInsideView }) => {
    const { x, y, width, height } = glazingArea;

    // Apply direction flip for inside view
    const effectiveDirection = isInsideView ? flipDirectionForInsideView(direction) : direction;

    // Lines go from hinge side center to opposite corners
    let hingeX: number;
    let hingeY: number;
    let corner1X: number;
    let corner1Y: number;
    let corner2X: number;
    let corner2Y: number;

    switch (effectiveDirection) {
        case 'left':
            // Hinge on left side center, lines go to right corners
            hingeX = x;
            hingeY = y + height / 2;
            corner1X = x + width;
            corner1Y = y;
            corner2X = x + width;
            corner2Y = y + height;
            break;
        case 'right':
            // Hinge on right side center, lines go to left corners
            hingeX = x + width;
            hingeY = y + height / 2;
            corner1X = x;
            corner1Y = y;
            corner2X = x;
            corner2Y = y + height;
            break;
        case 'up':
            // Hinge on top center, lines go to bottom corners
            hingeX = x + width / 2;
            hingeY = y;
            corner1X = x;
            corner1Y = y + height;
            corner2X = x + width;
            corner2Y = y + height;
            break;
        case 'down':
            // Hinge on bottom center, lines go to top corners
            hingeX = x + width / 2;
            hingeY = y + height;
            corner1X = x;
            corner1Y = y;
            corner2X = x + width;
            corner2Y = y;
            break;
        default:
            return null;
    }

    return (
        <g>
            <line
                x1={hingeX}
                y1={hingeY}
                x2={corner1X}
                y2={corner1Y}
                stroke={SYMBOL_COLOR}
                strokeWidth={SYMBOL_STROKE_WIDTH}
                strokeDasharray="4,3"
            />
            <line
                x1={hingeX}
                y1={hingeY}
                x2={corner2X}
                y2={corner2Y}
                stroke={SYMBOL_COLOR}
                strokeWidth={SYMBOL_STROKE_WIDTH}
                strokeDasharray="4,3"
            />
        </g>
    );
};

/**
 * SlideArrow renders a single arrow pointing in the slide direction.
 */
const SlideArrow: React.FC<SlideArrowProps> = ({ direction, glazingArea, isInsideView }) => {
    const { x, y, width, height } = glazingArea;
    const centerX = x + width / 2;
    const centerY = y + height * 0.5;

    // Apply direction flip for inside view
    const effectiveDirection = isInsideView ? flipDirectionForInsideView(direction) : direction;

    const arrowLength = Math.min(width, height) * 0.8;
    const arrowHeadSize = Math.min(width, height) * 0.1;

    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;
    let head1X: number;
    let head1Y: number;
    let head2X: number;
    let head2Y: number;

    switch (effectiveDirection) {
        case 'left':
            startX = centerX + arrowLength / 2;
            startY = centerY;
            endX = centerX - arrowLength / 2;
            endY = centerY;
            head1X = endX + arrowHeadSize;
            head1Y = endY - arrowHeadSize;
            head2X = endX + arrowHeadSize;
            head2Y = endY + arrowHeadSize;
            break;
        case 'right':
            startX = centerX - arrowLength / 2;
            startY = centerY;
            endX = centerX + arrowLength / 2;
            endY = centerY;
            head1X = endX - arrowHeadSize;
            head1Y = endY - arrowHeadSize;
            head2X = endX - arrowHeadSize;
            head2Y = endY + arrowHeadSize;
            break;
        case 'up':
            startX = centerX;
            startY = centerY + arrowLength / 2;
            endX = centerX;
            endY = centerY - arrowLength / 2;
            head1X = endX - arrowHeadSize;
            head1Y = endY + arrowHeadSize;
            head2X = endX + arrowHeadSize;
            head2Y = endY + arrowHeadSize;
            break;
        case 'down':
            startX = centerX;
            startY = centerY - arrowLength / 2;
            endX = centerX;
            endY = centerY + arrowLength / 2;
            head1X = endX - arrowHeadSize;
            head1Y = endY - arrowHeadSize;
            head2X = endX + arrowHeadSize;
            head2Y = endY - arrowHeadSize;
            break;
        default:
            return null;
    }

    return (
        <g>
            <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={SYMBOL_COLOR} strokeWidth={SYMBOL_STROKE_WIDTH} />
            <polyline
                points={`${head1X},${head1Y} ${endX},${endY} ${head2X},${head2Y}`}
                fill="none"
                stroke={SYMBOL_COLOR}
                strokeWidth={SYMBOL_STROKE_WIDTH}
            />
        </g>
    );
};

/**
 * OperationSymbol renders the appropriate symbols for a window operation.
 * Supports layered directions (e.g., tilt-turn with both 'left' and 'up').
 */
export const OperationSymbol: React.FC<OperationSymbolProps> = ({ operation, glazingArea, isInsideView }) => {
    const { type, directions } = operation;

    if (!directions || directions.length === 0) {
        return null;
    }

    return (
        <g>
            {directions.map((direction, index) =>
                type === 'swing' ? (
                    <SwingSymbol
                        key={`swing-${direction}-${index}`}
                        direction={direction}
                        glazingArea={glazingArea}
                        isInsideView={isInsideView}
                    />
                ) : (
                    <SlideArrow
                        key={`slide-${direction}-${index}`}
                        direction={direction}
                        glazingArea={glazingArea}
                        isInsideView={isInsideView}
                    />
                )
            )}
        </g>
    );
};
