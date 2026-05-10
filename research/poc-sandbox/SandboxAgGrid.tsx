import { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
    AllCommunityModule,
    ModuleRegistry,
    ColDef,
    GridReadyEvent,
    CellValueChangedEvent,
    RowClassParams,
    themeQuartz,
} from 'ag-grid-community';

// Plan §3.3 — AG Grid Community spike against the real Materials dataset
// (405 rows, served by the backend /_spike/materials route — no DB).
// Six behaviors to exercise: render, inline-edit text+number, select filter,
// numeric sort, resize+reorder, group by category. Findings → grid-spike-results.md.

ModuleRegistry.registerModules([AllCommunityModule]);

type MaterialRow = {
    name: string;
    category: string;
    density_kg_m3: number | null;
    specific_heat_capacity_J_kg_K: number | null;
    conductivity_w_mk: number | null;
    conductivity_btu_hr_ft_F: number | null;
    resistivity_hr_ft2_F_Btu_in: number | null;
    emissivity: number | null;
    ARGB_COLOR: string | null;
    display_name: string;
    source: string | null;
    DATASHEET: string | null;
    comments: string | null;
};

// REACT_APP_API_URL may end with a trailing slash; strip it.
const apiBase = (process.env.REACT_APP_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

// AG Grid v32+ moved several behaviors to Enterprise. The plan §3.3 spike
// brief explicitly calls out "license clarity (especially Community vs
// Enterprise feature boundaries)" — capture the gap visibly so it feeds
// into grid-spike-results.md.
const ENTERPRISE_FEATURES_REMOVED = [
    'Row grouping (group-by category) — needs RowGroupingModule (Enterprise)',
    'Set filter (AirTable-style multi-select on category) — Enterprise; using text filter instead',
    'Range/cell selection — Enterprise; using row selection only',
];

const SandboxAgGrid: React.FC = () => {
    const [rows, setRows] = useState<MaterialRow[]>([]);
    const [loadMs, setLoadMs] = useState<number | null>(null);
    const [editLog, setEditLog] = useState<string[]>([]);
    const gridRef = useRef<AgGridReact<MaterialRow>>(null);

    useEffect(() => {
        const t0 = performance.now();
        fetch(`${apiBase}/api/catalog-poc/_spike/materials`)
            .then(r => r.json())
            .then(data => {
                setRows(data.rows);
                setLoadMs(performance.now() - t0);
            })
            .catch(err => console.error('spike fetch failed', err));
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const columnDefs = useMemo<ColDef<MaterialRow>[]>(
        () => [
            {
                field: 'name',
                pinned: 'left',
                editable: true,
                filter: 'agTextColumnFilter',
                width: 180,
            },
            {
                field: 'category',
                filter: 'agTextColumnFilter',
                width: 160,
            },
            {
                field: 'display_name',
                editable: true,
                filter: 'agTextColumnFilter',
                width: 220,
            },
            {
                field: 'density_kg_m3',
                editable: true,
                filter: 'agNumberColumnFilter',
                type: 'numericColumn',
                valueParser: p => (p.newValue === '' ? null : Number(p.newValue)),
                width: 130,
            },
            {
                field: 'specific_heat_capacity_J_kg_K',
                editable: true,
                filter: 'agNumberColumnFilter',
                type: 'numericColumn',
                valueParser: p => (p.newValue === '' ? null : Number(p.newValue)),
                width: 180,
                headerName: 'Cp (J/kg·K)',
            },
            {
                field: 'conductivity_w_mk',
                editable: true,
                filter: 'agNumberColumnFilter',
                type: 'numericColumn',
                valueParser: p => (p.newValue === '' ? null : Number(p.newValue)),
                width: 130,
                headerName: 'λ (W/m·K)',
                sort: 'asc',
            },
            {
                field: 'conductivity_btu_hr_ft_F',
                filter: 'agNumberColumnFilter',
                type: 'numericColumn',
                width: 150,
                headerName: 'λ (Btu·in/hr·ft²·°F)',
                editable: false,
                cellStyle: { backgroundColor: '#f7f7f7', fontStyle: 'italic' },
                tooltipValueGetter: () => 'Computed (POC week-3): conductivity_w_mk × 6.9335',
            },
            {
                field: 'resistivity_hr_ft2_F_Btu_in',
                filter: 'agNumberColumnFilter',
                type: 'numericColumn',
                width: 130,
                headerName: 'R/in',
                editable: false,
                cellStyle: { backgroundColor: '#f7f7f7', fontStyle: 'italic' },
            },
            { field: 'emissivity', filter: 'agNumberColumnFilter', type: 'numericColumn', width: 110 },
            { field: 'ARGB_COLOR', width: 140, editable: true },
            { field: 'source', width: 200, editable: true },
            { field: 'comments', width: 240, editable: true, filter: 'agTextColumnFilter' },
        ],
        []
    );

    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: true,
            resizable: true,
            filter: true,
            floatingFilter: true,
        }),
        []
    );

    const onCellValueChanged = (e: CellValueChangedEvent<MaterialRow>) => {
        const msg = `${new Date().toLocaleTimeString()} — row "${e.data.name}" / col "${e.column.getColId()}": ${JSON.stringify(e.oldValue)} → ${JSON.stringify(e.newValue)}`;
        setEditLog(prev => [msg, ...prev].slice(0, 5));
    };

    const onGridReady = (e: GridReadyEvent<MaterialRow>) => {
        // Sample row-coloring rule: highlight rows where conductivity is very
        // low (good insulation). Tests the §6.1 "color a row based on a column
        // value" requirement.
        e.api.setGridOption('getRowStyle', (params: RowClassParams<MaterialRow>) => {
            const c = params.data?.conductivity_w_mk;
            if (c != null && c < 0.05) return { backgroundColor: '#e8f5e9' };
            if (c != null && c > 50) return { backgroundColor: '#ffebee' };
            return undefined;
        });
    };

    const styles: { [k: string]: React.CSSProperties } = {
        page: {
            padding: 16,
            fontFamily: 'system-ui, sans-serif',
            height: '100vh',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
        },
        header: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
        h1: { margin: 0, fontSize: 18 },
        meta: { fontSize: 12, color: '#666' },
        gridWrap: { flex: 1, minHeight: 400 },
        log: { fontSize: 11, color: '#444', maxHeight: 80, overflowY: 'auto', marginTop: 8, fontFamily: 'monospace' },
        button: { padding: '4px 10px', cursor: 'pointer' },
        gap: {
            background: '#fff8e1',
            border: '1px solid #f0c14b',
            padding: '6px 10px',
            fontSize: 11,
            color: '#5a4500',
            borderRadius: 4,
        },
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.h1}>Catalog POC — AG Grid spike (Materials, {rows.length} rows)</h1>
                <span style={styles.meta}>{loadMs != null ? `loaded in ${loadMs.toFixed(0)} ms` : 'loading...'}</span>
                <button style={styles.button} onClick={() => gridRef.current?.api.exportDataAsCsv?.()}>
                    Export CSV
                </button>
            </div>
            <div style={styles.gap}>
                <strong>AG Grid Community gaps surfaced (Enterprise-only in v32+):</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {ENTERPRISE_FEATURES_REMOVED.map(line => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            </div>
            <div style={styles.gridWrap}>
                <AgGridReact<MaterialRow>
                    ref={gridRef}
                    theme={themeQuartz}
                    rowData={rows}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onCellValueChanged={onCellValueChanged}
                    onGridReady={onGridReady}
                    animateRows
                    rowSelection={{ mode: 'multiRow' }}
                    pagination={false}
                />
            </div>
            <div style={styles.log}>
                {editLog.length === 0 ? (
                    <em>edit log: try inline-editing any cell — a server PATCH would fire here</em>
                ) : (
                    editLog.map((m, i) => <div key={i}>{m}</div>)
                )}
            </div>
        </div>
    );
};

export default SandboxAgGrid;
