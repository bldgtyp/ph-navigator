export const timelineStyleSx = {
    // Make the Completed Step Connector Blue
    '& .MuiStepConnector-vertical.Mui-completed > span': {
        borderColor: '#1976d2',
        borderWidth: '2px',
    },
    // Style the Active Step Connector
    '& .MuiStepConnector-vertical.Mui-active > span': {
        borderLeftColor: 'lightblue',
        borderLeftWidth: '2px',
        borderLeftStyle: 'dashed',
        position: 'relative',
        '::after': {
            content: "''",
            position: 'absolute',
            transform: 'translate(-90%, 10%)',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '10px 10px 10px 10px',
            borderColor: 'transparent transparent transparent lightblue',
        },
    },
    // Highlight Circle the Active Step Number
    '& .MuiStepLabel-iconContainer.Mui-active': {
        color: 'lightblue',
        position: 'relative',
        '&::after': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: '50%',
            left: '38%',
            width: '32px',
            height: '32px',
            border: '3px solid lightblue',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            transform: 'translate(-50%, -50%)',
        },
    },
};
