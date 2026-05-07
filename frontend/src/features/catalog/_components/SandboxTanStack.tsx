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
type CellCoord = { rowIndex: number; colIndex: number };
type SelectionRange = { anchor: CellCoord; head: CellCoord } | null;
type SelectionOrigin = 'cell' | 'row' | 'column' | 'all';
type DragRole = 'cell' | 'row' | 'column';

const GUTTER_WIDTH = 40;
const AUTO_SCROLL_EDGE_PX = 30;
const AUTO_SCROLL_STEP_PX = 10;

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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeSelection = (selection: SelectionRange) => {
    if (!selection) return null;
    return {
        topRow: Math.min(selection.anchor.rowIndex, selection.head.rowIndex),
        bottomRow: Math.max(selection.anchor.rowIndex, selection.head.rowIndex),
        leftCol: Math.min(selection.anchor.colIndex, selection.head.colIndex),
        rightCol: Math.max(selection.anchor.colIndex, selection.head.colIndex),
    };
};

const escapeHtml = (value: string): string =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const escapeTsvCell = (value: string): string => {
    if (!/[\t\n\r"]/.test(value)) return value;
    return `"${value.replaceAll('"', '""')}"`;
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
    const [selection, setSelection] = useState<SelectionRange>(null);
    const [selectionOrigin, setSelectionOrigin] = useState<SelectionOrigin>('cell');

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const autoScrollFrameRef = useRef<number | null>(null);

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
    const visibleColumns = table.getVisibleLeafColumns();
    const visibleColumnIds = visibleColumns.map(column => column.id);
    const colIndexById = useMemo(() => new Map(visibleColumnIds.map((id, index) => [id, index])), [visibleColumnIds]);
    const lastRowIndex = rowModel.length - 1;
    const lastColIndex = visibleColumnIds.length - 1;
    const normalizedSelection = useMemo(() => normalizeSelection(selection), [selection]);
    const fullRowSelectionActive =
        normalizedSelection != null &&
        normalizedSelection.leftCol === 0 &&
        normalizedSelection.rightCol === lastColIndex;
    const fullColumnSelectionActive =
        normalizedSelection != null &&
        normalizedSelection.topRow === 0 &&
        normalizedSelection.bottomRow === lastRowIndex;

    const coordToActiveCell = useCallback(
        (coord: CellCoord): ActiveCell => {
            const colId = visibleColumnIds[coord.colIndex];
            return colId ? { rowIndex: coord.rowIndex, colId } : null;
        },
        [visibleColumnIds]
    );

    const activeCoord = useMemo(() => {
        if (!activeCell) return null;
        const colIndex = colIndexById.get(activeCell.colId);
        if (colIndex == null) return null;
        return { rowIndex: activeCell.rowIndex, colIndex };
    }, [activeCell, colIndexById]);

    const setFocusedCoord = useCallback(
        (coord: CellCoord, origin: SelectionOrigin = 'cell') => {
            setActiveCell(coordToActiveCell(coord));
            setSelection({ anchor: coord, head: coord });
            setSelectionOrigin(origin);
        },
        [coordToActiveCell]
    );

    const extendSelectionTo = useCallback(
        (head: CellCoord, origin: SelectionOrigin) => {
            const clampedHead = {
                rowIndex: clamp(head.rowIndex, 0, lastRowIndex),
                colIndex: clamp(head.colIndex, 0, lastColIndex),
            };
            setSelection(prev => {
                const anchor = prev?.anchor ?? activeCoord ?? clampedHead;
                return { anchor, head: clampedHead };
            });
            setActiveCell(coordToActiveCell(clampedHead));
            setSelectionOrigin(origin);
        },
        [activeCoord, coordToActiveCell, lastColIndex, lastRowIndex]
    );

    const beginSelectionDrag = useCallback(
        (head: CellCoord, origin: SelectionOrigin, extend: boolean) => {
            if (extend) {
                extendSelectionTo(head, origin);
            } else {
                setFocusedCoord(head, origin);
            }
            isSelectingRef.current = true;
        },
        [extendSelectionTo, setFocusedCoord]
    );

    const updateSelectionFromRole = useCallback(
        (role: DragRole, rowIndex: number, colIndex: number, extend: boolean) => {
            if (lastRowIndex < 0 || lastColIndex < 0) return;
            if (role === 'row') {
                const anchor = extend && selection ? selection.anchor : { rowIndex, colIndex: 0 };
                const head = { rowIndex, colIndex: lastColIndex };
                setSelection({ anchor, head });
                setSelectionOrigin('row');
                setActiveCell(coordToActiveCell(head));
                return;
            }
            if (role === 'column') {
                const anchor = extend && selection ? selection.anchor : { rowIndex: 0, colIndex };
                const head = { rowIndex: lastRowIndex, colIndex };
                setSelection({ anchor, head });
                setSelectionOrigin('column');
                setActiveCell(coordToActiveCell({ rowIndex: 0, colIndex }));
                return;
            }
            beginSelectionDrag({ rowIndex, colIndex }, 'cell', extend);
        },
        [beginSelectionDrag, coordToActiveCell, lastColIndex, lastRowIndex, selection]
    );

    const updateSelectionFromPoint = useCallback(
        (clientX: number, clientY: number) => {
            const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
            const source = target?.closest<HTMLElement>('[data-selection-role]');
            if (!source) return;
            const role = source.dataset.selectionRole as DragRole | undefined;
            if (!role) return;
            const rowIndex = Number(source.dataset.rowIndex);
            const colIndex = Number(source.dataset.colIndex);
            if (role === 'column') {
                if (!Number.isFinite(colIndex)) return;
                updateSelectionFromRole(role, 0, colIndex, true);
                return;
            }
            if (!Number.isFinite(rowIndex)) return;
            if (role === 'row') {
                updateSelectionFromRole(role, rowIndex, 0, true);
                return;
            }
            if (!Number.isFinite(colIndex)) return;
            extendSelectionTo({ rowIndex, colIndex }, 'cell');
        },
        [extendSelectionTo, updateSelectionFromRole]
    );

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
        (dr: number, dc: number, extend: boolean) => {
            const seed = activeCoord ?? { rowIndex: 0, colIndex: 0 };
            let newCol = seed.colIndex + dc;
            let newRow = seed.rowIndex + dr;
            if (newCol > lastColIndex) {
                newCol = 0;
                newRow = Math.min(lastRowIndex, newRow + 1);
            } else if (newCol < 0) {
                newCol = lastColIndex;
                newRow = Math.max(0, newRow - 1);
            }
            const next = {
                rowIndex: clamp(newRow, 0, lastRowIndex),
                colIndex: clamp(newCol, 0, lastColIndex),
            };
            if (extend) {
                extendSelectionTo(next, 'cell');
            } else {
                setFocusedCoord(next, 'cell');
            }
        },
        [activeCoord, extendSelectionTo, lastColIndex, lastRowIndex, setFocusedCoord]
    );

    const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editing) return; // input owns its keys
        if (!activeCell) {
            // No focus yet — ArrowDown / ArrowRight / Enter / Tab seeds focus
            // at the top-left.
            if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Enter', 'Tab'].includes(e.key)) {
                setFocusedCoord({ rowIndex: 0, colIndex: 0 });
                e.preventDefault();
            }
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
                moveActive(-1, 0, e.shiftKey);
                e.preventDefault();
                break;
            case 'ArrowDown':
                moveActive(1, 0, e.shiftKey);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                moveActive(0, -1, e.shiftKey);
                e.preventDefault();
                break;
            case 'ArrowRight':
                moveActive(0, 1, e.shiftKey);
                e.preventDefault();
                break;
            case 'Tab':
                moveActive(0, e.shiftKey ? -1 : 1, false);
                e.preventDefault();
                break;
            case 'Home':
                if (activeCoord) {
                    const home = { rowIndex: activeCoord.rowIndex, colIndex: 0 };
                    if (e.shiftKey) {
                        extendSelectionTo(home, 'cell');
                    } else {
                        setFocusedCoord(home, 'cell');
                    }
                }
                e.preventDefault();
                break;
            case 'End':
                if (activeCoord) {
                    const end = { rowIndex: activeCoord.rowIndex, colIndex: lastColIndex };
                    if (e.shiftKey) {
                        extendSelectionTo(end, 'cell');
                    } else {
                        setFocusedCoord(end, 'cell');
                    }
                }
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
                setSelection(null);
                setActiveCell(null);
                e.preventDefault();
                break;
            case 'a':
            case 'A':
                if ((e.metaKey || e.ctrlKey) && lastRowIndex >= 0 && lastColIndex >= 0) {
                    setSelection({
                        anchor: { rowIndex: 0, colIndex: 0 },
                        head: { rowIndex: lastRowIndex, colIndex: lastColIndex },
                    });
                    setSelectionOrigin('all');
                    setActiveCell(coordToActiveCell({ rowIndex: 0, colIndex: 0 }));
                    e.preventDefault();
                }
                break;
            default:
                break;
        }
    };

    // Phase 2 — native copy handler for single-cell and rectangular range
    // selection. `text/plain` is TSV; `text/html` is a minimal table so rich
    // targets keep structure on paste.
    useEffect(() => {
        const onCopy = (e: ClipboardEvent) => {
            if (!activeCell || editing) return;
            const sel = window.getSelection?.();
            if (sel && sel.toString().length > 0) return;
            const selected =
                normalizeSelection(selection) ??
                normalizeSelection(activeCoord ? { anchor: activeCoord, head: activeCoord } : null);
            if (!selected) return;
            const selectedColIds = visibleColumnIds.slice(selected.leftCol, selected.rightCol + 1);
            const includeHeaderRow = selectionOrigin === 'column';
            const matrix: string[][] = [];
            if (includeHeaderRow) {
                matrix.push(selectedColIds.map(colId => String(COLUMN_LABELS[colId] ?? colId)));
            }
            for (let rowIndex = selected.topRow; rowIndex <= selected.bottomRow; rowIndex += 1) {
                const row = rowModel[rowIndex];
                if (!row) continue;
                matrix.push(
                    selectedColIds.map(colId => {
                        const cell = row.getVisibleCells().find(candidate => candidate.column.id === colId);
                        return cellAsText(cell?.getValue());
                    })
                );
            }
            const tsv = matrix.map(values => values.map(escapeTsvCell).join('\t')).join('\n');
            const html = `<table>${matrix
                .map(values => `<tr>${values.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
                .join('')}</table>`;
            e.clipboardData?.setData('text/plain', tsv);
            e.clipboardData?.setData('text/html', html);
            e.preventDefault();
        };
        document.addEventListener('copy', onCopy);
        return () => document.removeEventListener('copy', onCopy);
    }, [activeCell, activeCoord, editing, rowModel, selection, selectionOrigin, visibleColumnIds]);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (!isSelectingRef.current) return;
            pointerRef.current = { x: event.clientX, y: event.clientY };
            updateSelectionFromPoint(event.clientX, event.clientY);
        };

        const onMouseUp = () => {
            isSelectingRef.current = false;
            pointerRef.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [updateSelectionFromPoint]);

    useEffect(() => {
        const tick = () => {
            if (!isSelectingRef.current || !pointerRef.current || !tableContainerRef.current) {
                autoScrollFrameRef.current = requestAnimationFrame(tick);
                return;
            }
            const container = tableContainerRef.current;
            const rect = container.getBoundingClientRect();
            let dx = 0;
            let dy = 0;
            if (pointerRef.current.x < rect.left + AUTO_SCROLL_EDGE_PX) dx = -AUTO_SCROLL_STEP_PX;
            else if (pointerRef.current.x > rect.right - AUTO_SCROLL_EDGE_PX) dx = AUTO_SCROLL_STEP_PX;
            if (pointerRef.current.y < rect.top + AUTO_SCROLL_EDGE_PX) dy = -AUTO_SCROLL_STEP_PX;
            else if (pointerRef.current.y > rect.bottom - AUTO_SCROLL_EDGE_PX) dy = AUTO_SCROLL_STEP_PX;
            if (dx !== 0 || dy !== 0) {
                container.scrollBy({ left: dx, top: dy });
                updateSelectionFromPoint(pointerRef.current.x, pointerRef.current.y);
            }
            autoScrollFrameRef.current = requestAnimationFrame(tick);
        };
        autoScrollFrameRef.current = requestAnimationFrame(tick);
        return () => {
            if (autoScrollFrameRef.current != null) {
                cancelAnimationFrame(autoScrollFrameRef.current);
            }
        };
    }, [updateSelectionFromPoint]);

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
        gutterCell: {
            position: 'sticky',
            left: 0,
            zIndex: 4,
            width: GUTTER_WIDTH,
            minWidth: GUTTER_WIDTH,
            maxWidth: GUTTER_WIDTH,
            textAlign: 'right',
            color: '#666',
            paddingRight: 8,
            cursor: 'pointer',
            userSelect: 'none',
        },
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
    const selectionSummary =
        normalizedSelection == null
            ? null
            : `${normalizedSelection.bottomRow - normalizedSelection.topRow + 1}×${normalizedSelection.rightCol - normalizedSelection.leftCol + 1}`;

    return (
        <div style={styles.page}>
            {/* Inline stylesheet for hover + focus styling that's awkward to express inline. */}
            <style>{`
                .dt-row:hover .dt-cell { background-color: #fafafa; }
                .dt-cell-focused { outline: 2px solid #2563eb; outline-offset: -2px; background-color: #eff4fe !important; }
                .dt-frozen { position: sticky; left: 0; z-index: 1; background-clip: padding-box; }
                .dt-frozen-th { position: sticky; left: 0; top: 0; z-index: 3; }
                .dt-th-sticky { position: sticky; top: 0; z-index: 2; }
                .dt-frozen-divider { border-right: 1px solid #ccc !important; }
                .dt-gutter { position: sticky; left: 0; z-index: 5; background-clip: padding-box; }
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
                    {selectionSummary
                        ? `selection: ${selectionSummary}${activeCell ? ` | focus row ${activeCell.rowIndex + 1} / ${activeCell.colId}` : ''}`
                        : activeCell
                          ? `focus: row ${activeCell.rowIndex + 1} / ${activeCell.colId}`
                          : 'click any cell or press an arrow key to begin'}
                </span>
            </div>
            <div style={styles.info}>
                <strong>Phase 2 active:</strong> drag a contiguous range, use <code>Shift</code> + arrows or click to
                extend it, click the row gutter for full-row select, click the header strip for full-column select, and
                use ⌘C / Ctrl+C for TSV + HTML structured copy. Edits remain in-memory only.
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
                                <th
                                    className="dt-gutter dt-th-sticky"
                                    style={{ ...styles.th, ...styles.gutterCell, top: 0 }}
                                >
                                    #
                                </th>
                                {hg.headers.map(header => {
                                    const isFrozen = header.column.id === FROZEN_COLUMN;
                                    const thClass = `${isFrozen ? 'dt-frozen-th dt-frozen-divider' : 'dt-th-sticky'}`;
                                    const colIndex = visibleColumnIds.indexOf(header.column.id);
                                    const isColumnSelected =
                                        fullColumnSelectionActive &&
                                        normalizedSelection != null &&
                                        colIndex >= normalizedSelection.leftCol &&
                                        colIndex <= normalizedSelection.rightCol;
                                    return (
                                        <th
                                            key={header.id}
                                            className={thClass}
                                            style={{
                                                ...styles.th,
                                                width: header.getSize(),
                                                minWidth: header.getSize(),
                                                background: isColumnSelected ? '#dbeafe' : styles.th.background,
                                                ...(isFrozen ? { left: GUTTER_WIDTH } : {}),
                                            }}
                                            draggable
                                            onDragStart={onHeaderDragStart(header.column.id)}
                                            onDragOver={onHeaderDragOver}
                                            onDrop={onHeaderDrop(header.column.id)}
                                        >
                                            <div
                                                data-selection-role="column"
                                                data-col-index={colIndex}
                                                onMouseDown={e => {
                                                    if (editing) return;
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    tableContainerRef.current?.focus();
                                                    updateSelectionFromRole('column', 0, colIndex, e.shiftKey);
                                                    isSelectingRef.current = true;
                                                    pointerRef.current = { x: e.clientX, y: e.clientY };
                                                }}
                                                style={{
                                                    height: 8,
                                                    margin: '-4px -6px 4px',
                                                    background: isColumnSelected ? '#93c5fd' : '#e5e7eb',
                                                    cursor: 'cell',
                                                }}
                                            />
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
                                    {(() => {
                                        const rowSelected =
                                            fullRowSelectionActive &&
                                            normalizedSelection != null &&
                                            virtualRow.index >= normalizedSelection.topRow &&
                                            virtualRow.index <= normalizedSelection.bottomRow;
                                        const topEdge =
                                            rowSelected &&
                                            normalizedSelection != null &&
                                            virtualRow.index === normalizedSelection.topRow;
                                        const bottomEdge =
                                            rowSelected &&
                                            normalizedSelection != null &&
                                            virtualRow.index === normalizedSelection.bottomRow;
                                        return (
                                            <td
                                                className="dt-gutter dt-cell"
                                                data-selection-role="row"
                                                data-row-index={virtualRow.index}
                                                style={{
                                                    ...styles.td,
                                                    ...styles.gutterCell,
                                                    background: rowSelected ? '#dbeafe' : rowBg,
                                                    boxShadow: [
                                                        topEdge ? 'inset 0 2px 0 #2563eb' : '',
                                                        bottomEdge ? 'inset 0 -2px 0 #2563eb' : '',
                                                        rowSelected ? 'inset 2px 0 0 #2563eb' : '',
                                                        rowSelected ? 'inset -2px 0 0 #2563eb' : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(', '),
                                                }}
                                                onMouseDown={e => {
                                                    if (editing) return;
                                                    e.preventDefault();
                                                    tableContainerRef.current?.focus();
                                                    updateSelectionFromRole('row', virtualRow.index, 0, e.shiftKey);
                                                    isSelectingRef.current = true;
                                                    pointerRef.current = { x: e.clientX, y: e.clientY };
                                                }}
                                            >
                                                {virtualRow.index + 1}
                                            </td>
                                        );
                                    })()}
                                    {row.getVisibleCells().map(cell => {
                                        const colId = cell.column.id;
                                        const isFrozen = colId === FROZEN_COLUMN;
                                        const visualIdx = virtualRow.index;
                                        const dataIdx = row.index;
                                        const colIndex = visibleColumnIds.indexOf(colId);
                                        const isFocused =
                                            activeCell?.rowIndex === visualIdx && activeCell?.colId === colId;
                                        const isEditing = editing?.rowIndex === visualIdx && editing?.colId === colId;
                                        const isEditable = EDITABLE_FIELDS.has(colId);
                                        const isSelected =
                                            normalizedSelection != null &&
                                            visualIdx >= normalizedSelection.topRow &&
                                            visualIdx <= normalizedSelection.bottomRow &&
                                            colIndex >= normalizedSelection.leftCol &&
                                            colIndex <= normalizedSelection.rightCol;
                                        const isTopEdge = isSelected && normalizedSelection?.topRow === visualIdx;
                                        const isBottomEdge = isSelected && normalizedSelection?.bottomRow === visualIdx;
                                        const isLeftEdge = isSelected && normalizedSelection?.leftCol === colIndex;
                                        const isRightEdge = isSelected && normalizedSelection?.rightCol === colIndex;
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
                                                    background: isSelected
                                                        ? '#dbeafe'
                                                        : cell.getIsAggregated()
                                                          ? '#f0f0f0'
                                                          : undefined,
                                                    boxShadow: [
                                                        isTopEdge ? 'inset 0 2px 0 #2563eb' : '',
                                                        isBottomEdge ? 'inset 0 -2px 0 #2563eb' : '',
                                                        isLeftEdge ? 'inset 2px 0 0 #2563eb' : '',
                                                        isRightEdge ? 'inset -2px 0 0 #2563eb' : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(', '),
                                                    ...(isFrozen
                                                        ? {
                                                              left: GUTTER_WIDTH,
                                                              background: isSelected ? '#dbeafe' : rowBg,
                                                          }
                                                        : {}),
                                                }}
                                                data-selection-role="cell"
                                                data-row-index={visualIdx}
                                                data-col-index={colIndex}
                                                onMouseDown={e => {
                                                    if (cell.getIsGrouped() || cell.getIsAggregated()) return;
                                                    if (editing) return;
                                                    e.preventDefault();
                                                    tableContainerRef.current?.focus();
                                                    beginSelectionDrag(
                                                        { rowIndex: visualIdx, colIndex },
                                                        'cell',
                                                        e.shiftKey
                                                    );
                                                    pointerRef.current = { x: e.clientX, y: e.clientY };
                                                }}
                                                onDoubleClick={() => {
                                                    if (cell.getIsGrouped() || cell.getIsAggregated()) return;
                                                    if (!isEditable) return;
                                                    setFocusedCoord({ rowIndex: visualIdx, colIndex });
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
