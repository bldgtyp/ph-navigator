import { List, ListItem } from '@mui/material';
import { useContext, useState } from 'react';
import { UserContext } from '../../../../../auth/_contexts/UserContext';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';
import AssemblyListHeader from './Assembly.ListHeader';
import AssemblyListItemContent from './Assembly.ListItemContent';
import { AssemblySelectorProps } from './Assembly.Sidebar.Types';

const AssemblySidebar: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    onAssemblyChange,
    onAddAssembly,
    onDeleteAssembly,
    onNameChange,
}) => {
    const userContext = useContext(UserContext);
    const [nameChangeModal, setNameChangeModal] = useState({
        isOpen: false,
        assemblyId: 0,
        assemblyName: '',
    });

    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    // Modal handling functions
    const openNameChangeModal = (id: number, name: string) => {
        setNameChangeModal({ isOpen: true, assemblyId: id, assemblyName: name });
    };

    const closeNameChangeModal = () => {
        setNameChangeModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleNameSubmit = (newName: string) => {
        onNameChange(nameChangeModal.assemblyId, newName);
        closeNameChangeModal();
    };

    return (
        <>
            <ChangeNameModal
                assemblyName={nameChangeModal.assemblyName}
                open={nameChangeModal.isOpen}
                onClose={closeNameChangeModal}
                onSubmit={handleNameSubmit}
            />

            <AssemblyListHeader showAddButton={!!userContext.user} onAddAssembly={onAddAssembly} />

            <List dense>
                {sortedAssemblies.map(assembly => (
                    <ListItem key={assembly.id} component="div" disablePadding>
                        <AssemblyListItemContent
                            assembly={assembly}
                            isSelected={selectedAssemblyId === assembly.id}
                            showControls={!!userContext.user}
                            onSelect={onAssemblyChange}
                            onEditName={openNameChangeModal}
                            onDelete={onDeleteAssembly}
                        />
                    </ListItem>
                ))}
            </List>
        </>
    );
};

export default AssemblySidebar;
