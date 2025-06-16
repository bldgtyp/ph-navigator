import LinkIcon from '@mui/icons-material/Link';

// ----------------------------------------------------------------------------
/**
 * LinkIcon:
 * Renders a LinkIcon, or default text if none is found.
 * @param params - The parameters for the cell.
 * @returns The rendered link cell.
 */
export const LinkIconWithDefault: React.FC<{ value?: string }> = ({ value }) => {
    if (value) {
        return (
            <a href={value as string} target="_blank" rel="noopener noreferrer">
                <LinkIcon />
            </a>
        );
    } else {
        return <p>-</p>;
    }
};
