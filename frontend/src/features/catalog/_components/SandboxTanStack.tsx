import { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    GroupingState,
    ColumnOrderState,
    Row,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getGroupedRowModel,
    getExpandedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

// Plan §3.3 — TanStack Table v8 spike. Headless model: TanStack manages
// state (sort/filter/group/order/resize), we render the markup ourselves.
// Same Materials dataset and same six target behaviors as the AG Grid
// sandbox, plus group-by which AG Grid Community can't do.

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

const apiBase = (process.env.REACT_APP_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const NUMERIC_FIELDS = new Set([
    'density_kg_m3',
    'specific_heat_capacity_J_kg_K',
    'conductivity_w_mk',
    'conductivity_btu_hr_ft_F',
    'resistivity_hr_ft2_F_Btu_in',
    'emissivity',
]);

const COMPUTED_FIELDS = new Set(['conductivity_btu_hr_ft_F', 'resistivity_hr_ft2_F_Btu_in']);

const EDITABLE_FIELDS = new Set([
    'name',
    'display_name',
    'density_kg_m3',
    'specific_heat_capacity_J_kg_K',
    'conductivity_w_mk',
    'emissivity',
    'ARGB_COLOR',
    'source',
    'comments',
]);

const COLUMN_LABELS: Record<string, string> = {
    specific_heat_capacity_J_kg_K: 'Cp (J/kg·K)',
    conductivity_w_mk: 'λ (W/m·K)',
    conductivity_btu_hr_ft_F: 'λ (Btu·in/hr·ft²·°F)',
    resistivity_hr_ft2_F_Btu_in: 'R/in',
};

const COLUMN_WIDTHS: Record<string, number> = {
    name: 180,
    category: 160,
    display_name: 220,
    density_kg_m3: 130,
    specific_heat_capacity_J_kg_K: 180,
    conductivity_w_mk: 130,
    conductivity_btu_hr_ft_F: 150,
    resistivity_hr_ft2_F_Btu_in: 130,
    emissivity: 110,
    ARGB_COLOR: 140,
    source: 200,
    DATASHEET: 200,
    comments: 240,
};

const FIELD_ORDER: (keyof MaterialRow)[] = [
    'name',
    'category',
    'display_name',
    'density_kg_m3',
    'specific_heat_capacity_J_kg_K',
    'conductivity_w_mk',
    'conductivity_btu_hr_ft_F',
    'resistivity_hr_ft2_F_Btu_in',
    'emissivity',
    'ARGB_COLOR',
    'source',
    'comments',
];

type EditingCell = { rowIndex: number; colId: string } | null;

const SandboxTanStack: React.FC = () => {
    const [rows, setRows] = useState<MaterialRow[]>([]);
    const [loadMs, setLoadMs] = useState<number | null>(null);
    const [editLog, setEditLog] = useState<string[]>([]);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'conductivity_w_mk', desc: false }]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [grouping, setGrouping] = useState<GroupingState>([]);
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(FIELD_ORDER);
    const [editing, setEditing] = useState<EditingCell>(null);

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

    const commitEdit = (rowIndex: number, colId: string, raw: string) => {
        const oldValue = (rows[rowIndex] as any)[colId];
        let newValue: any = raw;
        if (NUMERIC_FIELDS.has(colId)) {
            newValue = raw === '' ? null : Number(raw);
            if (Number.isNaN(newValue)) newValue = oldValue;
        } else if (raw === '') {
            newValue = null;
        }
        if (newValue === oldValue) {
            setEditing(null);
            return;
        }
        setRows(prev => {
            const copy = prev.slice();
            copy[rowIndex] = { ...copy[rowIndex], [colId]: newValue };
            return copy;
        });
        setEditLog(prev =>
            [
                `${new Date().toLocaleTimeString()} — row "${rows[rowIndex].name}" / col "${colId}": ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`,
                ...prev,
            ].slice(0, 5)
        );
        setEditing(null);
    };

    const columns = useMemo<ColumnDef<MaterialRow>[]>(() => {
        return FIELD_ORDER.map<ColumnDef<MaterialRow>>(field => {
            const isNum = NUMERIC_FIELDS.has(field);
            return {
                id: field,
                accessorKey: field,
                header: COLUMN_LABELS[field] ?? field,
                size: COLUMN_WIDTHS[field] ?? 150,
                enableGrouping: field === 'category',
                filterFn: isNum ? 'inNumberRange' : 'includesString',
                aggregationFn: isNum ? 'mean' : undefined,
                cell: info => {
                    const value = info.getValue() as string | number | null;
                    const colId = info.column.id;
                    const rowIndex = info.row.index;
                    const isEditing = editing?.rowIndex === rowIndex && editing.colId === colId;
                    const isEditable = EDITABLE_FIELDS.has(colId);
                    const isComputed = COMPUTED_FIELDS.has(colId);

                    if (isEditing) {
                        return (
                            <input
                                autoFocus
                                defaultValue={value == null ? '' : String(value)}
                                onBlur={e => commitEdit(rowIndex, colId, e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditing(null);
                                }}
                                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit' }}
                            />
                        );
                    }
                    const display = value == null ? '' : isNum ? Number(value).toLocaleString() : String(value);
                    return (
                        <div
                            onDoubleClick={() => isEditable && setEditing({ rowIndex, colId })}
                            style={{
                                width: '100%',
                                cursor: isEditable ? 'text' : 'default',
                                fontStyle: isComputed ? 'italic' : 'normal',
                                color: isComputed ? '#666' : 'inherit',
                                textAlign: isNum ? 'right' : 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                            title={display}
                        >
                            {display}
                        </div>
                    );
                },
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, rows]);

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting, columnFilters, grouping, columnOrder },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGroupingChange: setGrouping,
        onColumnOrderChange: setColumnOrder,
        columnResizeMode: 'onChange',
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getGroupedRowModel: getGroupedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        autoResetExpanded: false,
    });

    const { rows: rowModel } = table.getRowModel();

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: rowModel.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 32,
        overscan: 12,
    });

    // HTML5 drag handlers for column reorder.
    const dragColRef = useRef<string | null>(null);
    const onHeaderDragStart = (id: string) => () => (dragColRef.current = id);
    const onHeaderDragOver = (e: React.DragEvent) => e.preventDefault();
    const onHeaderDrop = (targetId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        const sourceId = dragColRef.current;
        if (!sourceId || sourceId === targetId) return;
        setColumnOrder(prev => {
            const next = prev.slice();
            const from = next.indexOf(sourceId);
            const to = next.indexOf(targetId);
            if (from < 0 || to < 0) return prev;
            next.splice(to, 0, ...next.splice(from, 1));
            return next;
        });
        dragColRef.current = null;
    };

    const facetedCategories = useMemo(() => {
        const col = table.getColumn('category');
        if (!col) return [];
        return Array.from(col.getFacetedUniqueValues().keys()).sort();
        // rows kept in deps so faceted values re-evaluate on data change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, table]);

    const setCategoryFilter = (selected: string[]) => {
        const col = table.getColumn('category');
        if (!col) return;
        col.setFilterValue(
            selected.length === 0 ? undefined : (cellValue: unknown) => selected.includes(String(cellValue))
        );
    };

    const exportCsv = () => {
        const visibleCols = table.getVisibleLeafColumns();
        const head = visibleCols.map(c => c.id).join(',');
        const body = rowModel
            .filter(r => !r.getIsGrouped())
            .map(r =>
                visibleCols
                    .map(c => {
                        const v = (r.original as any)[c.id];
                        if (v == null) return '';
                        const s = String(v);
                        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
                    })
                    .join(',')
            )
            .join('\n');
        const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'materials_tanstack_export.csv';
        a.click();
        URL.revokeObjectURL(url);
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
        button: { padding: '4px 10px', cursor: 'pointer' },
        tableWrap: {
            flex: 1,
            minHeight: 400,
            overflow: 'auto',
            border: '1px solid #ddd',
            position: 'relative',
        },
        table: { borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' },
        th: {
            position: 'sticky',
            top: 0,
            background: '#f5f5f5',
            borderBottom: '1px solid #ccc',
            borderRight: '1px solid #e0e0e0',
            padding: '4px 6px',
            textAlign: 'left',
            fontSize: 12,
            zIndex: 1,
            userSelect: 'none',
        },
        td: {
            borderBottom: '1px solid #eee',
            borderRight: '1px solid #f3f3f3',
            padding: '4px 6px',
            fontSize: 12,
            verticalAlign: 'middle',
        },
        resizer: {
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 4,
            cursor: 'col-resize',
            userSelect: 'none',
            background: 'transparent',
        },
        resizerActive: { background: '#1976d2' },
        log: {
            fontSize: 11,
            color: '#444',
            maxHeight: 80,
            overflowY: 'auto',
            marginTop: 8,
            fontFamily: 'monospace',
        },
        info: {
            background: '#e8f5e9',
            border: '1px solid #a5d6a7',
            padding: '6px 10px',
            fontSize: 11,
            color: '#1b5e20',
            borderRadius: 4,
            marginBottom: 8,
        },
    };

    const filteredCount = rowModel.filter(r => !r.getIsGrouped()).length;

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.h1}>
                    Catalog POC — TanStack spike (Materials, {filteredCount}/{rows.length} rows)
                </h1>
                <span style={styles.meta}>{loadMs != null ? `loaded in ${loadMs.toFixed(0)} ms` : 'loading...'}</span>
                <button style={styles.button} onClick={() => setGrouping(g => (g.length ? [] : ['category']))}>
                    Group by category: {grouping.length ? 'ON' : 'OFF'}
                </button>
                <button style={styles.button} onClick={exportCsv}>
                    Export CSV
                </button>
                <span style={styles.meta}>filter category:</span>
                <select
                    multiple
                    size={1}
                    style={{ font: 'inherit', minWidth: 140 }}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                        setCategoryFilter(selected);
                    }}
                >
                    {facetedCategories.map(c => (
                        <option key={c as string} value={c as string}>
                            {c as string}
                        </option>
                    ))}
                </select>
            </div>
            <div style={styles.info}>
                <strong>TanStack OSS coverage:</strong> sort, filter (incl. faceted multi-select on category — the AG
                Grid Community gap), group-by, resize, drag-reorder, virtualization, inline edit — all from the
                MIT-licensed core. No Enterprise tier.
            </div>
            <div ref={tableContainerRef} style={styles.tableWrap}>
                <table style={styles.table}>
                    <thead>
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id}>
                                {hg.headers.map(header => (
                                    <th
                                        key={header.id}
                                        style={{
                                            ...styles.th,
                                            width: header.getSize(),
                                            minWidth: header.getSize(),
                                            position: 'sticky',
                                            top: 0,
                                        }}
                                        draggable
                                        onDragStart={onHeaderDragStart(header.column.id)}
                                        onDragOver={onHeaderDragOver}
                                        onDrop={onHeaderDrop(header.column.id)}
                                    >
                                        <div
                                            style={{ cursor: 'pointer' }}
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                                        </div>
                                        {header.column.getCanFilter() && header.column.id !== 'category' && (
                                            <input
                                                placeholder="filter..."
                                                value={(header.column.getFilterValue() as string) ?? ''}
                                                onChange={e => header.column.setFilterValue(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                    width: '90%',
                                                    marginTop: 2,
                                                    font: 'inherit',
                                                    fontSize: 11,
                                                }}
                                            />
                                        )}
                                        <div
                                            onMouseDown={header.getResizeHandler()}
                                            onTouchStart={header.getResizeHandler()}
                                            style={{
                                                ...styles.resizer,
                                                ...(header.column.getIsResizing() ? styles.resizerActive : {}),
                                            }}
                                        />
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map(virtualRow => {
                            const row = rowModel[virtualRow.index] as Row<MaterialRow>;
                            const c = row.original?.conductivity_w_mk;
                            const rowBg =
                                c != null && c < 0.05
                                    ? '#e8f5e9'
                                    : c != null && c > 50
                                      ? '#ffebee'
                                      : row.getIsGrouped()
                                        ? '#fafafa'
                                        : 'transparent';
                            return (
                                <tr
                                    key={row.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        transform: `translateY(${virtualRow.start}px)`,
                                        height: virtualRow.size,
                                        display: 'flex',
                                        background: rowBg,
                                    }}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td
                                            key={cell.id}
                                            style={{
                                                ...styles.td,
                                                width: cell.column.getSize(),
                                                minWidth: cell.column.getSize(),
                                                fontWeight: cell.getIsGrouped() ? 600 : 400,
                                                background: cell.getIsAggregated() ? '#f0f0f0' : undefined,
                                            }}
                                        >
                                            {cell.getIsGrouped() ? (
                                                <button
                                                    onClick={row.getToggleExpandedHandler()}
                                                    style={{ all: 'unset', cursor: 'pointer' }}
                                                >
                                                    {row.getIsExpanded() ? '▼' : '▶'}{' '}
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())} (
                                                    {row.subRows.length})
                                                </button>
                                            ) : cell.getIsAggregated() ? (
                                                flexRender(
                                                    cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )
                                            ) : cell.getIsPlaceholder() ? null : (
                                                flexRender(cell.column.columnDef.cell, cell.getContext())
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={styles.log}>
                {editLog.length === 0 ? (
                    <em>edit log: double-click any editable cell to begin</em>
                ) : (
                    editLog.map((m, i) => <div key={i}>{m}</div>)
                )}
            </div>
        </div>
    );
};

export default SandboxTanStack;
