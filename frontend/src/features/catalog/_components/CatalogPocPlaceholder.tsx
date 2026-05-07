import { useEffect, useState } from 'react';

// Catalog POC placeholder route. Not linked from main nav.
// See docs/features/2026-05-06-native-catalog-manager.md §13 and
// docs/plans/2026-05-06/catalog-poc-plan.md.
const CatalogPocPlaceholder: React.FC = () => {
    const [pingStatus, setPingStatus] = useState<string>('checking...');

    useEffect(() => {
        const apiBase = process.env.REACT_APP_API_URL ?? 'http://localhost:8000';
        fetch(`${apiBase}/api/catalog-poc/ping`)
            .then(r => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
            .then(data => setPingStatus(`backend ok — ${JSON.stringify(data)}`))
            .catch(err => setPingStatus(`backend unreachable: ${String(err)}`));
    }, []);

    return (
        <div style={{ padding: 24, fontFamily: 'monospace' }}>
            <h1>Catalog POC</h1>
            <p>Sandbox route — see plan §3.1.</p>
            <p>Ping: {pingStatus}</p>
        </div>
    );
};

export default CatalogPocPlaceholder;
