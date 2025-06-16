import Card from '@mui/material/Card';

const CardContainer: React.FC<any> = ({ children }) => {
    return (
        <Card
            className="project-card"
            elevation={5}
            sx={{
                minWidth: 300,
                minHeight: 250,
                maxWidth: 450,
                margin: '10px',
                backgroundColor: '#f5f5f5',
            }}
        >
            {children}
        </Card>
    );
};

export default CardContainer;
