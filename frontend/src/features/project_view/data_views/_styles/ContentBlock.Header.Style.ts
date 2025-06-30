const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--appbar-bg-color').trim();
const headerBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--outline-color').trim();

export const contentBlockHeaderStyle = {
    backgroundColor: headerBgColor,
    borderBottom: `1px solid ${headerBorderColor}`,
    padding: '16px',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    textAlign: 'left',
};
