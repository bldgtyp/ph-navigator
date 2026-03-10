import React, { createContext, useContext, useMemo } from 'react';
import { useProjectStatusQuery, ProjectStatusDataType } from '../_hooks/useProjectStatusQuery';

interface ProjectStatusContextType {
    projectData: ProjectStatusDataType;
    showModal: boolean;
}

const ProjectStatusDataContext = createContext<ProjectStatusContextType | null>(null);

export const ProjectStatusDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectData, showModal } = useProjectStatusQuery();

    const value = useMemo(() => ({ projectData, showModal }), [projectData, showModal]);

    return <ProjectStatusDataContext.Provider value={value}>{children}</ProjectStatusDataContext.Provider>;
};

export const useProjectStatusData = () => {
    const context = useContext(ProjectStatusDataContext);
    if (!context) {
        throw new Error('useProjectData must be used within a ProjectDataProvider');
    }
    return context;
};
