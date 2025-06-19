import { ListItem, ListItemIcon, Typography } from '@mui/material';
import { CheckBoxLiTextStyle, CheckBoxLiStyle } from './BlowerDoorTest.Styles';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

const CheckBoxLi: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ListItem sx={CheckBoxLiStyle}>
            <ListItemIcon sx={{ minWidth: 24 }}>
                <CheckBoxOutlineBlankIcon fontSize="small" />
            </ListItemIcon>
            <Typography sx={CheckBoxLiTextStyle}>{children}</Typography>
        </ListItem>
    );
};

export default CheckBoxLi;
