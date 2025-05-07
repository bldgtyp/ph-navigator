import { createTheme } from '@mui/material/styles';

const rootStyle = getComputedStyle(document.documentElement);
const primaryColor = rootStyle.getPropertyValue('--primary-color').trim();
const secondaryColor = rootStyle.getPropertyValue('--secondary-color').trim();
const textPrimaryColor = rootStyle.getPropertyValue('--text-primary-color').trim();
const textSecondaryColor = rootStyle.getPropertyValue('--text-secondary-color').trim();
const appBarBgColor = rootStyle.getPropertyValue('--appbar-bg-color').trim();
const borderColor = rootStyle.getPropertyValue('--outline-color').trim();


const theme = createTheme({
    palette: {
        primary: {
            main: primaryColor,
        },
        secondary: {
            main: secondaryColor,
        },
        text: {
            primary: textPrimaryColor,
            secondary: textSecondaryColor,
        },
    },
    typography: {
        fontFamily: '-apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
        h5: {
            fontSize: '1.25rem',
            fontWeight: 700,
            color: textPrimaryColor,
        }
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: appBarBgColor,
                    color: textPrimaryColor,
                    boxShadow: `${borderColor} 0px -1px 0px 0px inset`,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: textPrimaryColor,
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '7px',
                    borderColor: borderColor,
                    textTransform: 'none',
                },
            },
        },
    },
});

export default theme;