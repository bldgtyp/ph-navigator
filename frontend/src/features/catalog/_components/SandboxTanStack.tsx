import { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
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

// Catalog POC sandbox — TanStack Table v8.
// Phase 1 (active cell, keyboard nav, single-click focus, Enter-to-edit,
// frozen first column, ⌘C single-cell copy) lives here. Subsequent phases
// will keep evolving this file in place per airtable-parity-phases.md §2.4.

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
    name: 220,
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

// Phase 1.4 — frozen first column. Sticky-left so it stays visible while
// the rest of the table scrolls horizontally. Width is the value in
// COLUMN_WIDTHS for `name`.
const FROZEN_COLUMN = 'name';

type ActiveCell = { rowIndex: number; colId: string } | null;
type EditingCell = { rowIndex: number; colId: string } | null;

// Plain-text representation of a cell value for clipboard / display.
// Numbers serialize as their raw string (no thousands separators, so paste
// round-trips into Excel as numbers). Single-select pill rendering will
// override this when 1c lands.
const cellAsText = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'number') return String(value);
    return String(value);
};

const cellAsDisplay = (value: unknown, isNum: boolean): string => {
    if (value == null) return '';
    if (isNum && typeof value === 'number') return value.toLocaleString();
    return String(value);
};

const SandboxTanStack: React.FC = () => {
    const [rows, setRows] = useState<MaterialRow[]>([]);
    const [loadMs, setLoadMs] = useState<number | null>(null);
    const [editLog, setEditLog] = useState<string[]>([]);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'conductivity_w_mk', desc: false }]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [grouping, setGrouping] = useState<GroupingState>([]);
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(FIELD_ORDER);
    const [editing, setEditing] = useState<EditingCell>(null);
    const [activeCell, setActiveCell] = useState<ActiveCell>(null);

    const tableContainerRef = useRef<HTMLDivElement>(null);

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

    // commitEdit takes a *data* row index — the position in `rows`. The td
    // render layer translates from visual position (rowModel index) to
    // data index via rowModel[visualIdx].index before calling.
    const commitEdit = useCallback(
        (dataRowIdx: number, colId: string, raw: string) => {
            const oldValue = (rows[dataRowIdx] as any)?.[colId];
            let newValue: any = raw;
            if (NUMERIC_FIELDS.has(colId)) {
                newValue = raw === '' ? null : Number(raw);
                if (Number.isNaN(newValue)) newValue = oldValue;
            } else if (raw === '') {
                newValue = null;
            }
            if (newValue !== oldValue) {
                setRows(prev => {
                    const copy = prev.slice();
                    copy[dataRowIdx] = { ...copy[dataRowIdx], [colId]: newValue };
                    return copy;
                });
                setEditLog(prev =>
                    [
                        `${new Date().toLocaleTimeString()} — row "${rows[dataRowIdx]?.name}" / col "${colId}": ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`,
                        ...prev,
                    ].slice(0, 5)
                );
            }
            setEditing(null);
            // Restore focus to the table container so keyboard nav resumes.
            tableContainerRef.current?.focus();
        },
        [rows]
    );

    // Column defs are *display only* — focus / editing rendering happens at
    // the <td> level so the column memo doesn't invalidate on every keystroke
    // and so we can index by visual row position rather than data row index.
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
                    const value = info.getValue();
                    const colId = info.column.id;
                    const isComputed = COMPUTED_FIELDS.has(colId);
                    return (
                        <div
                            style={{
                                width: '100%',
                                fontStyle: isComputed ? 'italic' : 'normal',
                                color: isComputed ? '#666' : 'inherit',
                                textAlign: isNum ? 'right' : 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                            title={cellAsDisplay(value, isNum)}
                        >
                            {cellAsDisplay(value, isNum)}
                        </div>
                    );
                },
            };
        });
    }, []);

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

    const rowVirtualizer = useVirtualizer({
        count: rowModel.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 32,
        overscan: 12,
    });

    // Phase 1.5 — auto-scroll the focused row into view when activeCell
    // changes. Vertical only for now; horizontal auto-scroll is deferred
    // (frozen-column interaction adds non-trivial offset math; flagged in
    // weekly-notes findings).
    useEffect(() => {
        if (!activeCell) return;
        rowVirtualizer.scrollToIndex(activeCell.rowIndex, { align: 'auto' });
    }, [activeCell, rowVirtualizer]);

    // Phase 1.2 — keyboard navigation. Bound to the container; ignored
    // when an edit input is focused (input handles its own keys + stops
    // propagation for Enter/Escape via the cell renderer).
    const moveActive = useCallback(
        (dr: number, dc: number) => {
            setActiveCell(curr => {
                if (!curr) return curr;
                const colIdx = columnOrder.indexOf(curr.colId);
                if (colIdx < 0) return curr;
                const lastCol = columnOrder.length - 1;
                const lastRow = rowModel.length - 1;
                let newCol = colIdx + dc;
                let newRow = curr.rowIndex + dr;
                // Tab/Shift+Tab wrap horizontally to next/prev row.
                if (newCol > lastCol) {
                    newCol = 0;
                    newRow = Math.min(lastRow, newRow + 1);
                } else if (newCol < 0) {
                    newCol = lastCol;
                    newRow = Math.max(0, newRow - 1);
                }
                newRow = Math.max(0, Math.min(lastRow, newRow));
                return { rowIndex: newRow, colId: columnOrder[newCol] as string };
            });
        },
        [columnOrder, rowModel.length]
    );

    const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editing) return; // input owns its keys
        if (!activeCell) {
            // No focus yet — ArrowDown / ArrowRight / Enter / Tab seeds focus
            // at the top-left.
            if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Enter', 'Tab'].includes(e.key)) {
                setActiveCell({ rowIndex: 0, colId: columnOrder[0] as string });
                e.preventDefault();
            }
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
                moveActive(-1, 0);
                e.preventDefault();
                break;
            case 'ArrowDown':
                moveActive(1, 0);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                moveActive(0, -1);
                e.preventDefault();
                break;
            case 'ArrowRight':
                moveActive(0, 1);
                e.preventDefault();
                break;
            case 'Tab':
                moveActive(0, e.shiftKey ? -1 : 1);
                e.preventDefault();
                break;
            case 'Home':
                setActiveCell(curr => (curr ? { ...curr, colId: columnOrder[0] as string } : curr));
                e.preventDefault();
                break;
            case 'End':
                setActiveCell(curr =>
                    curr ? { ...curr, colId: columnOrder[columnOrder.length - 1] as string } : curr
                );
                e.preventDefault();
                break;
            case 'Enter': {
                if (EDITABLE_FIELDS.has(activeCell.colId)) {
                    setEditing({ ...activeCell });
                }
                e.preventDefault();
                break;
            }
            case 'Escape':
                setActiveCell(null);
                e.preventDefault();
                break;
            default:
                break;
        }
    };

    // Phase 1.7 — single-cell ⌘C copy. Listen for the native `copy` event so
    // we get a real ClipboardEvent with clipboardData. Active only when a
    // cell is focused and not editing (in which case the input owns copy).
    // activeCell.rowIndex is a *visual position* in rowModel, so look up
    // the underlying record via rowModel[i].original.
    useEffect(() => {
        const onCopy = (e: ClipboardEvent) => {
            if (!activeCell || editing) return;
            const sel = window.getSelection?.();
            if (sel && sel.toString().length > 0) return;
            const original = rowModel[activeCell.rowIndex]?.original;
            if (!original) return;
            const value = (original as any)[activeCell.colId];
            e.clipboardData?.setData('text/plain', cellAsText(value));
            e.preventDefault();
        };
        document.addEventListener('copy', onCopy);
        return () => document.removeEventListener('copy', onCopy);
    }, [activeCell, editing, rowModel]);

    // HTML5 drag handlers for column reorder (kept from prior spike;
    // Phase 5 will replace with @dnd-kit).
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
            outline: 'none',
        },
        table: { borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' },
        th: {
            background: '#f5f5f5',
            borderBottom: '1px solid #ccc',
            borderRight: '1px solid #e0e0e0',
            padding: '4px 6px',
            textAlign: 'left',
            fontSize: 12,
            userSelect: 'none',
        },
        td: {
            borderBottom: '1px solid #eee',
            borderRight: '1px solid #f3f3f3',
            padding: '4px 6px',
            fontSize: 12,
            verticalAlign: 'middle',
            cursor: 'cell',
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
            {/* Inline stylesheet for hover + focus styling that's awkward to express inline. */}
            <style>{`
                .dt-row:hover .dt-cell { background-color: #fafafa; }
                .dt-cell-focused { box-shadow: inset 0 0 0 2px #2563eb; background-color: #eff4fe !important; }
                .dt-frozen { position: sticky; left: 0; z-index: 1; background-clip: padding-box; }
                .dt-frozen-th { position: sticky; left: 0; top: 0; z-index: 3; }
                .dt-th-sticky { position: sticky; top: 0; z-index: 2; }
                .dt-frozen-divider { border-right: 1px solid #ccc !important; }
            `}</style>
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
                <span style={{ ...styles.meta, marginLeft: 'auto' }}>
                    {activeCell
                        ? `focus: row ${activeCell.rowIndex + 1} / ${activeCell.colId}`
                        : 'click any cell or press an arrow key to begin'}
                </span>
            </div>
            <div style={styles.info}>
                <strong>Phase 1 active:</strong> click a cell to focus, arrow keys / Tab / Home / End to navigate, Enter
                (or double-click) to edit, ⌘C copies the focused cell. Frozen `name` column. Vertical auto-scroll on
                focus change. (Range selection, paste, undo land in later phases.)
            </div>
            <div
                ref={tableContainerRef}
                style={styles.tableWrap}
                tabIndex={0}
                onKeyDown={handleContainerKeyDown}
                onMouseDown={() => tableContainerRef.current?.focus()}
            >
                <table style={styles.table}>
                    <thead>
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id}>
                                {hg.headers.map(header => {
                                    const isFrozen = header.column.id === FROZEN_COLUMN;
                                    const thClass = `${isFrozen ? 'dt-frozen-th dt-frozen-divider' : 'dt-th-sticky'}`;
                                    return (
                                        <th
                                            key={header.id}
                                            className={thClass}
                                            style={{
                                                ...styles.th,
                                                width: header.getSize(),
                                                minWidth: header.getSize(),
                                                ...(isFrozen ? { left: 0 } : {}),
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
                                    );
                                })}
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
                                        : '#ffffff';
                            return (
                                <tr
                                    key={row.id}
                                    className="dt-row"
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
                                    {row.getVisibleCells().map(cell => {
                                        const colId = cell.column.id;
                                        const isFrozen = colId === FROZEN_COLUMN;
                                        const visualIdx = virtualRow.index;
                                        const dataIdx = row.index;
                                        const isFocused =
                                            activeCell?.rowIndex === visualIdx && activeCell?.colId === colId;
                                        const isEditing = editing?.rowIndex === visualIdx && editing?.colId === colId;
                                        const isEditable = EDITABLE_FIELDS.has(colId);
                                        const cellClass = [
                                            'dt-cell',
                                            isFrozen ? 'dt-frozen dt-frozen-divider' : '',
                                            isFocused ? 'dt-cell-focused' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ');
                                        return (
                                            <td
                                                key={cell.id}
                                                className={cellClass}
                                                style={{
                                                    ...styles.td,
                                                    width: cell.column.getSize(),
                                                    minWidth: cell.column.getSize(),
                                                    fontWeight: cell.getIsGrouped() ? 600 : 400,
                                                    background: cell.getIsAggregated() ? '#f0f0f0' : undefined,
                                                    ...(isFrozen ? { left: 0, background: rowBg } : {}),
                                                }}
                                                onClick={() => {
                                                    if (cell.getIsGrouped() || cell.getIsAggregated()) return;
                                                    setActiveCell({ rowIndex: visualIdx, colId });
                                                }}
                                                onDoubleClick={() => {
                                                    if (cell.getIsGrouped() || cell.getIsAggregated()) return;
                                                    if (!isEditable) return;
                                                    setActiveCell({ rowIndex: visualIdx, colId });
                                                    setEditing({ rowIndex: visualIdx, colId });
                                                }}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        defaultValue={
                                                            (row.original as any)?.[colId] == null
                                                                ? ''
                                                                : String((row.original as any)[colId])
                                                        }
                                                        onBlur={e => commitEdit(dataIdx, colId, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                (e.target as HTMLInputElement).blur();
                                                                e.stopPropagation();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditing(null);
                                                                tableContainerRef.current?.focus();
                                                                e.stopPropagation();
                                                            }
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            font: 'inherit',
                                                        }}
                                                    />
                                                ) : cell.getIsGrouped() ? (
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
                                                        cell.column.columnDef.aggregatedCell ??
                                                            cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )
                                                ) : cell.getIsPlaceholder() ? null : (
                                                    flexRender(cell.column.columnDef.cell, cell.getContext())
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={styles.log}>
                {editLog.length === 0 ? (
                    <em>edit log: focus a cell and press Enter (or double-click) to edit</em>
                ) : (
                    editLog.map((m, i) => <div key={i}>{m}</div>)
                )}
            </div>
        </div>
    );
};

export default SandboxTanStack;
