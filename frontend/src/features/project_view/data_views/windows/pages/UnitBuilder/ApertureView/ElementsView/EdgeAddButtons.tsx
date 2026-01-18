import { useContext, useState } from 'react';
import type { FC } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

import { useApertures } from '../../../../_contexts/Aperture.Context';
import { useViewDirection } from '../ViewDirection.Context';
import { UserContext } from '../../../../../../../auth/_contexts/UserContext';

type EdgePosition = 'top' | 'bottom' | 'left' | 'right';

interface EdgeHoverZoneProps {
    edge: EdgePosition;
    onAdd: () => void;
    isVisible: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    disabled: boolean;
}

const HOVER_ZONE_SIZE = 40;

const getEdgeStyles = (edge: EdgePosition): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    };

    switch (edge) {
        case 'top':
            return {
                ...base,
                top: -HOVER_ZONE_SIZE,
                left: 0,
                right: 0,
                height: HOVER_ZONE_SIZE,
            };
        case 'bottom':
            return {
                ...base,
                bottom: -HOVER_ZONE_SIZE,
                left: 0,
                right: 0,
                height: HOVER_ZONE_SIZE,
            };
        case 'left':
            return {
                ...base,
                left: -HOVER_ZONE_SIZE,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_SIZE,
            };
        case 'right':
            return {
                ...base,
                right: -HOVER_ZONE_SIZE,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_SIZE,
            };
    }
};

const getTooltipLabel = (edge: EdgePosition): string => {
    switch (edge) {
        case 'top':
            return 'Add row at top';
        case 'bottom':
            return 'Add row at bottom';
        case 'left':
            return 'Add column at left';
        case 'right':
            return 'Add column at right';
    }
};

const EdgeHoverZone: FC<EdgeHoverZoneProps> = ({ edge, onAdd, isVisible, onMouseEnter, onMouseLeave, disabled }) => {
    return (
        <Box sx={getEdgeStyles(edge)} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <Tooltip title={getTooltipLabel(edge)} placement={edge === 'left' || edge === 'right' ? edge : 'top'} arrow>
                <span>
                    <IconButton
                        onClick={onAdd}
                        disabled={disabled}
                        size="small"
                        sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: 'rgba(25, 118, 210, 0.9)',
                            color: 'white',
                            borderRadius: '50%',
                            opacity: isVisible ? 1 : 0,
                            transform: isVisible ? 'scale(1)' : 'scale(0.7)',
                            transition: 'opacity 200ms ease-out, transform 200ms ease-out',
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 1)',
                                transform: 'scale(1.1)',
                            },
                            '&.Mui-disabled': {
                                opacity: 0.4,
                                backgroundColor: 'rgba(0, 0, 0, 0.12)',
                                color: 'rgba(0, 0, 0, 0.26)',
                            },
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                    >
                        <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );
};

const EdgeAddButtons: FC = () => {
    const userContext = useContext(UserContext);
    const { isLoadingApertures, handleAddRowAtEdge, handleAddColumnAtEdge } = useApertures();
    const { isInsideView } = useViewDirection();
    const [hoveredEdge, setHoveredEdge] = useState<EdgePosition | null>(null);

    // Only show for logged-in users
    if (!userContext.user) {
        return null;
    }

    // When viewing from inside, visual left = data right, visual right = data left
    const handleLeftEdge = () => {
        const dataEdge = isInsideView ? 'right' : 'left';
        handleAddColumnAtEdge(dataEdge);
    };

    const handleRightEdge = () => {
        const dataEdge = isInsideView ? 'left' : 'right';
        handleAddColumnAtEdge(dataEdge);
    };

    return (
        <>
            <EdgeHoverZone
                edge="top"
                onAdd={() => handleAddRowAtEdge('top')}
                isVisible={hoveredEdge === 'top'}
                onMouseEnter={() => setHoveredEdge('top')}
                onMouseLeave={() => setHoveredEdge(null)}
                disabled={isLoadingApertures}
            />
            <EdgeHoverZone
                edge="bottom"
                onAdd={() => handleAddRowAtEdge('bottom')}
                isVisible={hoveredEdge === 'bottom'}
                onMouseEnter={() => setHoveredEdge('bottom')}
                onMouseLeave={() => setHoveredEdge(null)}
                disabled={isLoadingApertures}
            />
            <EdgeHoverZone
                edge="left"
                onAdd={handleLeftEdge}
                isVisible={hoveredEdge === 'left'}
                onMouseEnter={() => setHoveredEdge('left')}
                onMouseLeave={() => setHoveredEdge(null)}
                disabled={isLoadingApertures}
            />
            <EdgeHoverZone
                edge="right"
                onAdd={handleRightEdge}
                isVisible={hoveredEdge === 'right'}
                onMouseEnter={() => setHoveredEdge('right')}
                onMouseLeave={() => setHoveredEdge(null)}
                disabled={isLoadingApertures}
            />
        </>
    );
};

export default EdgeAddButtons;
