import { Tooltip } from "@mui/material";
import { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

export const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.palette.common.white,
        boxShadow: theme.shadows[1],
        color: 'rgba(0, 0, 0, 0.9)',
        fontSize: 10,
        position: 'relative',
    },
    [`& .${tooltipClasses.tooltip}::before`]: {
        content: '""',
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: '5px',
        borderStyle: 'solid',
        borderColor: `${theme.palette.common.white} transparent transparent transparent`,
    },
}));
