// Side panel displaying properties of the selected 3D element

import { useSelectedObjectContext } from '../../_contexts/selected_object_context';
import { fieldConfigs } from './fieldConfigs';
import InfoField from './InfoField';
import './ElementInfoPanel.css';

export default function ElementInfoPanel() {
    const { selectedObjectState } = useSelectedObjectContext();

    const isVisible = selectedObjectState !== null;
    const userData = selectedObjectState?.userData || {};
    const elementType = userData.type as string | undefined;
    const config = elementType ? fieldConfigs[elementType] : null;
    const identifier = userData.identifier as string | undefined;

    // Filter out identifier from fields since we display it separately
    const fieldsWithoutIdentifier = config?.fields.filter(f => f.key !== 'identifier') || [];

    return (
        <div className={`element-info-panel ${isVisible ? 'visible' : ''}`}>
            {config ? (
                <>
                    <div className="element-info-panel-header">{config.title}</div>
                    {identifier && <div className="element-info-panel-identifier">{identifier}</div>}
                    <div className="element-info-panel-content">
                        {fieldsWithoutIdentifier.map(fieldConfig => (
                            <InfoField key={fieldConfig.key} config={fieldConfig} userData={userData} />
                        ))}
                    </div>
                </>
            ) : isVisible ? (
                <>
                    <div className="element-info-panel-header">Element</div>
                    {identifier && <div className="element-info-panel-identifier">{identifier}</div>}
                    <div className="element-info-panel-content">
                        <div className="info-field">
                            <span className="info-field-label">Type</span>
                            <span className="info-field-value">{elementType || 'Unknown'}</span>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
