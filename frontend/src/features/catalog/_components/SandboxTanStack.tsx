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
import {
    CellCoord,
    CellWrite,
    EditHistory,
    EditOp,
    FieldOptionWrite,
    SelectionRange,
    getClipboardValue,
    getPastePlan,
    normalizeSelection,
    parseTsv,
    popRedo,
    popUndo,
    pushHistory,
} from './sandboxPhase3';
import {
    SingleSelectOption,
    compareSingleSelectValues,
    findSingleSelectOptionById,
    findSingleSelectOptionByName,
    getSingleSelectNextColor,
    getSingleSelectOptionLabel,
    getSingleSelectTextColor,
    matchOrCreateSingleSelectOption,
    seedSingleSelectValues,
} from './sandboxPhase4';

// Catalog POC sandbox — TanStack Table v8.
// Phase 1 (active cell, keyboard nav, single-click focus, Enter-to-edit,
// frozen first column, ⌘C single-cell copy) lives here. Subsequent phases
// will keep evolving this file in place per airtable-parity-phases.md §2.4.

type MaterialRow = {
    name: string;
    category: string | null;
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
    'category',
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
type SelectionOrigin = 'cell' | 'row' | 'column' | 'all';
type DragRole = 'cell' | 'row' | 'column';
type FieldType = 'text' | 'number' | 'single_select' | 'computed';
type FieldDef = {
    fieldKey: keyof MaterialRow;
    fieldType: FieldType;
    config?: {
        options?: SingleSelectOption[];
    };
};
type FillDragState = {
    source: NonNullable<ReturnType<typeof normalizeSelection>>;
    target: NonNullable<ReturnType<typeof normalizeSelection>>;
    axis: 'row' | 'col';
} | null;

const GUTTER_WIDTH = 40;
const AUTO_SCROLL_EDGE_PX = 30;
const AUTO_SCROLL_STEP_PX = 10;
const PHASE_4_BANNER =
    'Phase 4 active: single-select pills, picker/create, and paste-aware option creation are in-memory only.';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const escapeHtml = (value: string): string =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const escapeTsvCell = (value: string): string => {
    if (!/[\t\n\r"]/.test(value)) return value;
    return `"${value.replaceAll('"', '""')}"`;
};

const createBlankRow = (): MaterialRow => ({
    name: '',
    category: null,
    density_kg_m3: null,
    specific_heat_capacity_J_kg_K: null,
    conductivity_w_mk: null,
    conductivity_btu_hr_ft_F: null,
    resistivity_hr_ft2_F_Btu_in: null,
    emissivity: null,
    ARGB_COLOR: null,
    display_name: '',
    source: null,
    DATASHEET: null,
    comments: null,
});

const createInitialFieldDefs = (categoryOptions: SingleSelectOption[]): Record<string, FieldDef> =>
    FIELD_ORDER.reduce<Record<string, FieldDef>>((acc, fieldKey) => {
        let fieldType: FieldType = 'text';
        if (fieldKey === 'category') fieldType = 'single_select';
        else if (COMPUTED_FIELDS.has(fieldKey)) fieldType = 'computed';
        else if (NUMERIC_FIELDS.has(fieldKey)) fieldType = 'number';
        acc[fieldKey] = {
            fieldKey,
            fieldType,
            config: fieldType === 'single_select' ? { options: categoryOptions } : undefined,
        };
        return acc;
    }, {});

const pillStyle = (option: SingleSelectOption): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    padding: '2px 10px',
    borderRadius: 999,
    background: option.color,
    color: getSingleSelectTextColor(option.color),
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
});

const compareNumberValues = (left: unknown, right: unknown): number => {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return Number(left) - Number(right);
};

const compareTextValues = (left: unknown, right: unknown): number => {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return String(left).localeCompare(String(right));
};

type SingleSelectEditorProps = {
    onCancel: () => void;
    onCommit: (rawValue: string) => void;
    options: SingleSelectOption[];
    value: string | null;
};

const SingleSelectEditor: React.FC<SingleSelectEditorProps> = ({ onCancel, onCommit, options, value }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const currentOption = findSingleSelectOptionById(options, value);
    const [query, setQuery] = useState('');
    const [createMode, setCreateMode] = useState(false);
    const filteredOptions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter(option => option.name.toLowerCase().includes(needle));
    }, [options, query]);
    const exactMatch = useMemo(() => findSingleSelectOptionByName(options, query), [options, query]);
    const createDisabled = !query.trim() || Boolean(exactMatch);
    const [highlightIndex, setHighlightIndex] = useState(() => {
        if (!currentOption) return 0;
        const currentIndex = options.findIndex(option => option.id === currentOption.id);
        return currentIndex >= 0 ? currentIndex : 0;
    });
    const createColor = getSingleSelectNextColor(options.length);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    useEffect(() => {
        const maxIndex = Math.max(filteredOptions.length - 1, 0);
        setHighlightIndex(prev => clamp(prev, 0, maxIndex));
    }, [filteredOptions.length]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return;
            onCancel();
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [onCancel]);

    const commitOption = (option: SingleSelectOption) => onCommit(option.name);

    return (
        <div
            ref={rootRef}
            onMouseDown={event => event.stopPropagation()}
            style={{
                position: 'absolute',
                top: 'calc(100% - 1px)',
                left: 0,
                width: 280,
                padding: 8,
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: '#ffffff',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.16)',
                zIndex: 20,
            }}
        >
            <input
                ref={inputRef}
                value={query}
                onChange={event => {
                    setQuery(event.target.value);
                    setCreateMode(false);
                }}
                onKeyDown={event => {
                    if (event.key === 'ArrowDown') {
                        setHighlightIndex(index => clamp(index + 1, 0, Math.max(filteredOptions.length - 1, 0)));
                        event.preventDefault();
                        return;
                    }
                    if (event.key === 'ArrowUp') {
                        setHighlightIndex(index => clamp(index - 1, 0, Math.max(filteredOptions.length - 1, 0)));
                        event.preventDefault();
                        return;
                    }
                    if (event.key === 'Enter') {
                        if (createMode && !createDisabled) {
                            onCommit(query);
                        } else {
                            const option = filteredOptions[highlightIndex] ?? filteredOptions[0];
                            if (option) commitOption(option);
                            else if (!createDisabled) onCommit(query);
                        }
                        event.preventDefault();
                        return;
                    }
                    if (event.key === 'Escape') {
                        onCancel();
                        event.preventDefault();
                    }
                }}
                placeholder="Search options..."
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 8,
                    padding: '6px 8px',
                    font: 'inherit',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                }}
            />
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => (
                        <button
                            key={option.id}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => commitOption(option)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                width: '100%',
                                padding: 6,
                                borderRadius: 8,
                                border:
                                    index === highlightIndex
                                        ? '1px solid #2563eb'
                                        : '1px solid rgba(148, 163, 184, 0.35)',
                                background: index === highlightIndex ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer',
                            }}
                        >
                            <span style={pillStyle(option)}>{option.name}</span>
                            {option.id === currentOption?.id ? (
                                <span style={{ fontSize: 11, color: '#475569' }}>current</span>
                            ) : null}
                        </button>
                    ))
                ) : (
                    <div style={{ padding: '6px 4px', fontSize: 11, color: '#64748b' }}>No matching options.</div>
                )}
            </div>
            <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                {!createMode ? (
                    <button
                        type="button"
                        disabled={createDisabled}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => setCreateMode(true)}
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: '1px dashed #94a3b8',
                            background: createDisabled ? '#f8fafc' : '#ffffff',
                            color: createDisabled ? '#94a3b8' : '#0f172a',
                            cursor: createDisabled ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        + Add new option
                    </button>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                                style={{
                                    ...pillStyle({ id: 'preview', name: query || 'New option', color: createColor }),
                                    flex: 1,
                                }}
                            >
                                {query || 'New option'}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>next color</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                disabled={createDisabled}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => onCommit(query)}
                                style={{
                                    flex: 1,
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    border: '1px solid #2563eb',
                                    background: createDisabled ? '#bfdbfe' : '#2563eb',
                                    color: '#ffffff',
                                    cursor: createDisabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Create and select
                            </button>
                            <button
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => setCreateMode(false)}
                                style={{
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SandboxTanStack: React.FC = () => {
    const [rows, setRows] = useState<MaterialRow[]>([]);
    const [fieldDefs, setFieldDefs] = useState<Record<string, FieldDef>>(() => createInitialFieldDefs([]));
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
    const [history, setHistory] = useState<EditHistory>({ undo: [], redo: [] });
    const [banner, setBanner] = useState<string>(PHASE_4_BANNER);
    const [fillDrag, setFillDrag] = useState<FillDragState>(null);

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);
    const isFillDraggingRef = useRef(false);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const autoScrollFrameRef = useRef<number | null>(null);
    const clearBannerTimerRef = useRef<number | null>(null);

    useEffect(() => {
        const t0 = performance.now();
        fetch(`${apiBase}/api/catalog-poc/_spike/materials`)
            .then(r => r.json())
            .then(data => {
                const seededCategory = seedSingleSelectValues(data.rows.map((row: MaterialRow) => row.category));
                setFieldDefs(createInitialFieldDefs(seededCategory.options));
                setRows(
                    data.rows.map((row: MaterialRow, index: number) => ({
                        ...row,
                        category: seededCategory.values[index],
                    }))
                );
                setLoadMs(performance.now() - t0);
            })
            .catch(err => console.error('spike fetch failed', err));
    }, []);

    const showBanner = useCallback((message: string) => {
        setBanner(message);
        if (clearBannerTimerRef.current != null) {
            window.clearTimeout(clearBannerTimerRef.current);
        }
        clearBannerTimerRef.current = window.setTimeout(() => {
            setBanner(PHASE_4_BANNER);
        }, 3500);
    }, []);

    useEffect(
        () => () => {
            if (clearBannerTimerRef.current != null) {
                window.clearTimeout(clearBannerTimerRef.current);
            }
        },
        []
    );

    const categoryOptions = fieldDefs.category?.config?.options ?? [];

    const getCellText = useCallback(
        (colId: string, value: unknown): string => {
            if (value == null) return '';
            const fieldDef = fieldDefs[colId];
            if (fieldDef?.fieldType === 'single_select') {
                return getSingleSelectOptionLabel(fieldDef.config?.options ?? [], value);
            }
            if (typeof value === 'number') return String(value);
            return String(value);
        },
        [fieldDefs]
    );

    const getCellDisplay = useCallback(
        (colId: string, value: unknown, isNum: boolean): string => {
            if (value == null) return '';
            const fieldDef = fieldDefs[colId];
            if (fieldDef?.fieldType === 'single_select') {
                return getSingleSelectOptionLabel(fieldDef.config?.options ?? [], value);
            }
            if (isNum && typeof value === 'number') return value.toLocaleString();
            return String(value);
        },
        [fieldDefs]
    );

    const coerceValue = useCallback((defs: Record<string, FieldDef>, colId: string, raw: string, oldValue: unknown) => {
        if (COMPUTED_FIELDS.has(colId) || !EDITABLE_FIELDS.has(colId)) {
            return { value: oldValue, status: 'read-only' as const };
        }
        const fieldDef = defs[colId];
        if (fieldDef?.fieldType === 'single_select') {
            const beforeOptions = fieldDef.config?.options ?? [];
            const result = matchOrCreateSingleSelectOption({ options: beforeOptions, rawValue: raw });
            return {
                value: result.value,
                status: 'ok' as const,
                createdOption: result.createdOption,
                fieldOptionWrite:
                    result.options === beforeOptions
                        ? undefined
                        : ({
                              fieldKey: colId,
                              before: beforeOptions,
                              after: result.options,
                          } satisfies FieldOptionWrite),
            };
        }
        if (NUMERIC_FIELDS.has(colId)) {
            if (raw === '') return { value: null, status: 'ok' as const };
            const next = Number(raw);
            if (Number.isNaN(next)) return { value: oldValue, status: 'type-mismatch' as const };
            return { value: next, status: 'ok' as const };
        }
        return { value: raw === '' ? null : raw, status: 'ok' as const };
    }, []);

    const applyOp = useCallback((op: EditOp, direction: 'forward' | 'reverse') => {
        setRows(prev => {
            const next = prev.slice();
            if (direction === 'forward' && op.appendedRows > 0) {
                for (let i = 0; i < op.appendedRows; i += 1) {
                    next.push(createBlankRow());
                }
            }
            op.writes.forEach(write => {
                const current = next[write.rowIndex];
                if (!current) return;
                next[write.rowIndex] = {
                    ...current,
                    [write.colId]: direction === 'forward' ? write.after : write.before,
                };
            });
            if (direction === 'reverse' && op.appendedRows > 0) {
                next.splice(next.length - op.appendedRows, op.appendedRows);
            }
            return next;
        });
        if (op.fieldOptionWrites?.length) {
            setFieldDefs(prev => {
                const next = { ...prev };
                op.fieldOptionWrites?.forEach(write => {
                    const current = next[write.fieldKey];
                    if (!current) return;
                    next[write.fieldKey] = {
                        ...current,
                        config: {
                            ...current.config,
                            options: (direction === 'forward' ? write.after : write.before) as SingleSelectOption[],
                        },
                    };
                });
                return next;
            });
        }
    }, []);

    const applyWrites = useCallback(
        ({
            writes,
            kind,
            appendedRows = 0,
            fieldOptionWrites = [],
            summary,
            pushToHistory = true,
        }: {
            writes: CellWrite[];
            kind: EditOp['kind'];
            appendedRows?: number;
            fieldOptionWrites?: FieldOptionWrite[];
            summary: string;
            pushToHistory?: boolean;
        }) => {
            if (writes.length === 0 && appendedRows === 0 && fieldOptionWrites.length === 0) return false;
            const op: EditOp = { kind, writes, appendedRows, fieldOptionWrites, summary };
            applyOp(op, 'forward');
            if (pushToHistory) {
                setHistory(prev => pushHistory(prev, op));
            }
            setEditLog(prev => [`${new Date().toLocaleTimeString()} — ${summary}`, ...prev].slice(0, 8));
            showBanner(summary);
            return true;
        },
        [applyOp, showBanner]
    );

    // Column defs are *display only* — focus / editing rendering happens at
    // the <td> level so the column memo doesn't invalidate on every keystroke
    // and so we can index by visual row position rather than data row index.
    const columns = useMemo<ColumnDef<MaterialRow>[]>(() => {
        return FIELD_ORDER.map<ColumnDef<MaterialRow>>(field => {
            const isNum = NUMERIC_FIELDS.has(field);
            const fieldDef = fieldDefs[field];
            const isSingleSelect = fieldDef?.fieldType === 'single_select';
            return {
                id: field,
                accessorKey: field,
                header: COLUMN_LABELS[field] ?? field,
                size: COLUMN_WIDTHS[field] ?? 150,
                enableGrouping: field === 'category',
                sortUndefined: 'last',
                sortingFn: isSingleSelect
                    ? (rowA, rowB, columnId) =>
                          compareSingleSelectValues(
                              rowA.getValue(columnId),
                              rowB.getValue(columnId),
                              fieldDef.config?.options ?? []
                          )
                    : isNum
                      ? (rowA, rowB, columnId) => compareNumberValues(rowA.getValue(columnId), rowB.getValue(columnId))
                      : (rowA, rowB, columnId) =>
                            compareTextValues(
                                getCellText(columnId, rowA.getValue(columnId)),
                                getCellText(columnId, rowB.getValue(columnId))
                            ),
                filterFn: isSingleSelect
                    ? (row, columnId, filterValue: string[] | undefined) => {
                          if (!filterValue || filterValue.length === 0) return true;
                          const value = row.getValue(columnId);
                          return value != null && filterValue.includes(String(value));
                      }
                    : isNum
                      ? 'inNumberRange'
                      : 'includesString',
                aggregationFn: isNum ? 'mean' : undefined,
                cell: info => {
                    const value = info.getValue();
                    const colId = info.column.id;
                    const isComputed = COMPUTED_FIELDS.has(colId);
                    if (isSingleSelect) {
                        const option = findSingleSelectOptionById(fieldDef.config?.options ?? [], value);
                        if (!option) return null;
                        return (
                            <div style={{ width: '100%', overflow: 'hidden' }} title={option.name}>
                                <span style={pillStyle(option)}>{option.name}</span>
                            </div>
                        );
                    }
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
                            title={getCellDisplay(colId, value, isNum)}
                        >
                            {getCellDisplay(colId, value, isNum)}
                        </div>
                    );
                },
            };
        });
    }, [fieldDefs, getCellDisplay, getCellText]);

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

    const cancelEditing = useCallback(() => {
        setEditing(null);
        tableContainerRef.current?.focus();
    }, []);

    const commitEdit = useCallback(
        (dataRowIdx: number, colId: string, raw: string) => {
            const oldValue = (rows[dataRowIdx] as any)?.[colId];
            const coerced = coerceValue(fieldDefs, colId, raw, oldValue);
            if (coerced.status === 'read-only') {
                showBanner(`Skipped read-only field: ${colId}`);
            } else if (coerced.status === 'type-mismatch') {
                showBanner(`Skipped type mismatch in ${colId}`);
            } else if (coerced.value !== oldValue) {
                applyWrites({
                    kind: 'cell',
                    writes: [{ rowIndex: dataRowIdx, colId, before: oldValue, after: coerced.value }],
                    fieldOptionWrites: coerced.fieldOptionWrite ? [coerced.fieldOptionWrite] : [],
                    summary: `Edited row "${rows[dataRowIdx]?.name || dataRowIdx + 1}" / ${colId}${coerced.createdOption ? `, created option "${coerced.createdOption.name}"` : ''}`,
                });
            }
            cancelEditing();
        },
        [applyWrites, cancelEditing, coerceValue, fieldDefs, rows, showBanner]
    );

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

    const performUndo = useCallback(() => {
        setHistory(prev => {
            const result = popUndo(prev);
            if (!result.op) return prev;
            applyOp(result.op, 'reverse');
            showBanner(`Reverted: ${result.op.summary}`);
            return result.history;
        });
    }, [applyOp, showBanner]);

    const performRedo = useCallback(() => {
        setHistory(prev => {
            const result = popRedo(prev);
            if (!result.op) return prev;
            applyOp(result.op, 'forward');
            showBanner(`Replayed: ${result.op.summary}`);
            return result.history;
        });
    }, [applyOp, showBanner]);

    const performFill = useCallback(
        (target: NonNullable<ReturnType<typeof normalizeSelection>>) => {
            if (!normalizedSelection || grouping.length > 0) {
                showBanner(grouping.length > 0 ? 'Ungroup to use fill.' : 'Select a source range first.');
                return;
            }
            const source = normalizedSelection;
            const sameRect =
                source.topRow === target.topRow &&
                source.bottomRow === target.bottomRow &&
                source.leftCol === target.leftCol &&
                source.rightCol === target.rightCol;
            if (sameRect) return;

            const extendsDown = target.bottomRow > source.bottomRow && target.leftCol === source.leftCol;
            const extendsRight = target.rightCol > source.rightCol && target.topRow === source.topRow;
            if (!extendsDown && !extendsRight) return;

            const writes: CellWrite[] = [];
            if (extendsDown) {
                const sourceHeight = source.bottomRow - source.topRow + 1;
                const sourceWidth = source.rightCol - source.leftCol + 1;
                for (let rowIndex = source.bottomRow + 1; rowIndex <= target.bottomRow; rowIndex += 1) {
                    for (let colIndex = source.leftCol; colIndex <= source.rightCol; colIndex += 1) {
                        const sourceRowIndex = source.topRow + ((rowIndex - source.topRow) % sourceHeight);
                        const sourceColIndex = source.leftCol + ((colIndex - source.leftCol) % sourceWidth);
                        const sourceRow = rowModel[sourceRowIndex];
                        const targetRow = rowModel[rowIndex];
                        const colId = visibleColumnIds[colIndex];
                        if (!sourceRow || !targetRow || !colId) continue;
                        const oldValue = (rows[targetRow.index] as any)?.[colId];
                        const rawValue = getCellText(colId, (rows[sourceRow.index] as any)?.[colId]);
                        const coerced = coerceValue(fieldDefs, colId, rawValue, oldValue);
                        if (coerced.status !== 'ok' || coerced.value === oldValue) continue;
                        writes.push({ rowIndex: targetRow.index, colId, before: oldValue, after: coerced.value });
                    }
                }
            } else if (extendsRight) {
                const sourceHeight = source.bottomRow - source.topRow + 1;
                const sourceWidth = source.rightCol - source.leftCol + 1;
                for (let rowIndex = source.topRow; rowIndex <= source.bottomRow; rowIndex += 1) {
                    for (let colIndex = source.rightCol + 1; colIndex <= target.rightCol; colIndex += 1) {
                        const sourceRowIndex = source.topRow + ((rowIndex - source.topRow) % sourceHeight);
                        const sourceColIndex = source.leftCol + ((colIndex - source.leftCol) % sourceWidth);
                        const sourceRow = rowModel[sourceRowIndex];
                        const targetRow = rowModel[rowIndex];
                        const colId = visibleColumnIds[colIndex];
                        const sourceColId = visibleColumnIds[sourceColIndex];
                        if (!sourceRow || !targetRow || !colId || !sourceColId) continue;
                        const oldValue = (rows[targetRow.index] as any)?.[colId];
                        const rawValue = getCellText(sourceColId, (rows[sourceRow.index] as any)?.[sourceColId]);
                        const coerced = coerceValue(fieldDefs, colId, rawValue, oldValue);
                        if (coerced.status !== 'ok' || coerced.value === oldValue) continue;
                        writes.push({ rowIndex: targetRow.index, colId, before: oldValue, after: coerced.value });
                    }
                }
            }

            if (
                applyWrites({
                    kind: 'fill',
                    writes,
                    summary: `Fill wrote ${writes.length} cell${writes.length === 1 ? '' : 's'}`,
                })
            ) {
                setSelection({
                    anchor: { rowIndex: source.topRow, colIndex: source.leftCol },
                    head: { rowIndex: target.bottomRow, colIndex: target.rightCol },
                });
            }
        },
        [
            applyWrites,
            coerceValue,
            fieldDefs,
            getCellText,
            grouping.length,
            normalizedSelection,
            rowModel,
            rows,
            showBanner,
            visibleColumnIds,
        ]
    );

    const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editing) return; // input owns its keys
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) performRedo();
            else performUndo();
            e.preventDefault();
            return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && normalizedSelection) {
            performFill({
                topRow: normalizedSelection.topRow,
                bottomRow: lastRowIndex,
                leftCol: normalizedSelection.leftCol,
                rightCol: normalizedSelection.rightCol,
            });
            e.preventDefault();
            return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r' && normalizedSelection) {
            performFill({
                topRow: normalizedSelection.topRow,
                bottomRow: normalizedSelection.bottomRow,
                leftCol: normalizedSelection.leftCol,
                rightCol: lastColIndex,
            });
            e.preventDefault();
            return;
        }
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
                        return getCellText(colId, cell?.getValue());
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
    }, [activeCell, activeCoord, editing, getCellText, rowModel, selection, selectionOrigin, visibleColumnIds]);

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            if (editing || !tableContainerRef.current?.contains(document.activeElement)) return;
            if (grouping.length > 0) {
                showBanner('Ungroup to paste.');
                e.preventDefault();
                return;
            }
            const selected =
                normalizeSelection(selection) ??
                normalizeSelection(activeCoord ? { anchor: activeCoord, head: activeCoord } : null);
            if (!selected) return;
            const raw = e.clipboardData?.getData('text/plain');
            if (!raw) return;
            const clipboard = parseTsv(raw);
            const plan = getPastePlan({
                selection: selected,
                clipboard,
                rowCount: rows.length,
                columnCount: visibleColumnIds.length,
            });
            if (plan.width <= 0) {
                showBanner('Paste clipped: no writable columns to the right of the anchor.');
                e.preventDefault();
                return;
            }
            let appendedRows = 0;
            if (plan.overflowRows > 0) {
                const accepted = window.confirm(
                    `Clipboard has ${plan.overflowRows} more row${plan.overflowRows === 1 ? '' : 's'} than the table. Add ${plan.overflowRows} empty record${plan.overflowRows === 1 ? '' : 's'} and paste?`
                );
                if (!accepted) {
                    e.preventDefault();
                    showBanner('Paste cancelled.');
                    return;
                }
                appendedRows = plan.overflowRows;
            }

            const workingRows = rows.concat(Array.from({ length: appendedRows }, () => createBlankRow()));
            const workingFieldDefs = Object.fromEntries(
                Object.entries(fieldDefs).map(([fieldKey, fieldDef]) => [
                    fieldKey,
                    {
                        ...fieldDef,
                        config: fieldDef.config?.options
                            ? { ...fieldDef.config, options: [...fieldDef.config.options] }
                            : fieldDef.config,
                    },
                ])
            ) as Record<string, FieldDef>;
            const writes: CellWrite[] = [];
            const fieldOptionWrites = new Map<string, FieldOptionWrite>();
            const createdOptionsByField = new Map<string, string[]>();
            let skippedType = 0;
            let skippedReadOnly = 0;
            for (let rowOffset = 0; rowOffset < plan.height; rowOffset += 1) {
                const visualRowIndex = plan.anchor.rowIndex + rowOffset;
                const row = rowModel[visualRowIndex];
                const dataRowIndex = row ? row.index : rows.length + (visualRowIndex - rows.length);
                for (let colOffset = 0; colOffset < plan.width; colOffset += 1) {
                    const colIndex = plan.anchor.colIndex + colOffset;
                    const colId = visibleColumnIds[colIndex];
                    if (!colId) continue;
                    const oldValue = (workingRows[dataRowIndex] as any)?.[colId];
                    const rawValue = getClipboardValue({ clipboard, rowOffset, colOffset, selection: selected });
                    const coerced = coerceValue(workingFieldDefs, colId, rawValue, oldValue);
                    if (coerced.status === 'read-only') {
                        skippedReadOnly += 1;
                        continue;
                    }
                    if (coerced.status === 'type-mismatch') {
                        skippedType += 1;
                        continue;
                    }
                    if (coerced.fieldOptionWrite) {
                        const existingWrite = fieldOptionWrites.get(colId);
                        fieldOptionWrites.set(colId, {
                            fieldKey: colId,
                            before: existingWrite?.before ?? coerced.fieldOptionWrite.before,
                            after: coerced.fieldOptionWrite.after,
                        });
                        workingFieldDefs[colId] = {
                            ...workingFieldDefs[colId],
                            config: {
                                ...workingFieldDefs[colId].config,
                                options: coerced.fieldOptionWrite.after as SingleSelectOption[],
                            },
                        };
                    }
                    if (coerced.createdOption) {
                        const created = createdOptionsByField.get(colId) ?? [];
                        createdOptionsByField.set(colId, [...created, coerced.createdOption.name]);
                    }
                    if (coerced.value === oldValue) continue;
                    writes.push({ rowIndex: dataRowIndex, colId, before: oldValue, after: coerced.value });
                    (workingRows[dataRowIndex] as any)[colId] = coerced.value;
                }
            }

            const newOptionSummary = Array.from(createdOptionsByField.entries())
                .filter(([, names]) => names.length > 0)
                .map(([fieldKey, names]) => {
                    const label = names.length === 1 ? 'new option created' : `${names.length} new options created`;
                    return `${label} in "${fieldKey}": ${names.join(', ')}`;
                })
                .join('; ');

            applyWrites({
                kind: 'paste',
                writes,
                appendedRows,
                fieldOptionWrites: Array.from(fieldOptionWrites.values()),
                summary: `Paste wrote ${writes.length} cell${writes.length === 1 ? '' : 's'}${newOptionSummary ? `, ${newOptionSummary}` : ''}${skippedType ? `, skipped ${skippedType} type mismatch` : ''}${skippedReadOnly ? `, skipped ${skippedReadOnly} read-only` : ''}${plan.clippedColumnCount ? `, clipped ${plan.clippedColumnCount} column${plan.clippedColumnCount === 1 ? '' : 's'}` : ''}`,
            });
            e.preventDefault();
        };
        document.addEventListener('paste', onPaste);
        return () => document.removeEventListener('paste', onPaste);
    }, [
        activeCoord,
        applyWrites,
        coerceValue,
        editing,
        fieldDefs,
        grouping.length,
        rowModel,
        rows,
        selection,
        showBanner,
        visibleColumnIds,
    ]);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (isFillDraggingRef.current && normalizedSelection) {
                pointerRef.current = { x: event.clientX, y: event.clientY };
                const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
                const source = target?.closest<HTMLElement>('[data-selection-role="cell"]');
                if (!source) return;
                const rowIndex = Number(source.dataset.rowIndex);
                const colIndex = Number(source.dataset.colIndex);
                if (!Number.isFinite(rowIndex) || !Number.isFinite(colIndex)) return;
                const rowDelta = rowIndex - normalizedSelection.bottomRow;
                const colDelta = colIndex - normalizedSelection.rightCol;
                const axis = Math.abs(rowDelta) >= Math.abs(colDelta) ? 'row' : 'col';
                if (axis === 'row' && rowIndex >= normalizedSelection.bottomRow) {
                    setFillDrag({
                        source: normalizedSelection,
                        axis,
                        target: {
                            topRow: normalizedSelection.topRow,
                            bottomRow: rowIndex,
                            leftCol: normalizedSelection.leftCol,
                            rightCol: normalizedSelection.rightCol,
                        },
                    });
                } else if (axis === 'col' && colIndex >= normalizedSelection.rightCol) {
                    setFillDrag({
                        source: normalizedSelection,
                        axis,
                        target: {
                            topRow: normalizedSelection.topRow,
                            bottomRow: normalizedSelection.bottomRow,
                            leftCol: normalizedSelection.leftCol,
                            rightCol: colIndex,
                        },
                    });
                }
                return;
            }
            if (!isSelectingRef.current) return;
            pointerRef.current = { x: event.clientX, y: event.clientY };
            updateSelectionFromPoint(event.clientX, event.clientY);
        };

        const onMouseUp = () => {
            if (isFillDraggingRef.current && fillDrag) {
                performFill(fillDrag.target);
            }
            isSelectingRef.current = false;
            isFillDraggingRef.current = false;
            pointerRef.current = null;
            setFillDrag(null);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [fillDrag, normalizedSelection, performFill, updateSelectionFromPoint]);

    useEffect(() => {
        const tick = () => {
            if (
                (!isSelectingRef.current && !isFillDraggingRef.current) ||
                !pointerRef.current ||
                !tableContainerRef.current
            ) {
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
                if (isSelectingRef.current) {
                    updateSelectionFromPoint(pointerRef.current.x, pointerRef.current.y);
                }
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
        const visibleValues = new Set(Array.from(col.getFacetedUniqueValues().keys()).map(value => String(value)));
        return categoryOptions.filter(option => visibleValues.size === 0 || visibleValues.has(option.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryOptions, rows, table]);

    const setCategoryFilter = (selected: string[]) => {
        const col = table.getColumn('category');
        if (!col) return;
        col.setFilterValue(selected.length === 0 ? undefined : selected);
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
                        const s = getCellText(c.id, v);
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
            position: 'relative',
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
                <button style={styles.button} onClick={performUndo} disabled={history.undo.length === 0}>
                    Undo
                </button>
                <button style={styles.button} onClick={performRedo} disabled={history.redo.length === 0}>
                    Redo
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
                        <option key={c.id} value={c.id}>
                            {c.name}
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
                <strong>Phase 4 active:</strong> {banner}
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
                            const rowIsEditing = editing?.rowIndex === virtualRow.index;
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
                                        zIndex: rowIsEditing ? 8 : 0,
                                        overflow: 'visible',
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
                                        const isFillPreview =
                                            fillDrag != null &&
                                            visualIdx >= fillDrag.target.topRow &&
                                            visualIdx <= fillDrag.target.bottomRow &&
                                            colIndex >= fillDrag.target.leftCol &&
                                            colIndex <= fillDrag.target.rightCol &&
                                            !(
                                                visualIdx >= fillDrag.source.topRow &&
                                                visualIdx <= fillDrag.source.bottomRow &&
                                                colIndex >= fillDrag.source.leftCol &&
                                                colIndex <= fillDrag.source.rightCol
                                            );
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
                                                    maxWidth: cell.column.getSize(),
                                                    flex: `0 0 ${cell.column.getSize()}px`,
                                                    fontWeight: cell.getIsGrouped() ? 600 : 400,
                                                    background: isFillPreview
                                                        ? '#eff6ff'
                                                        : isSelected
                                                          ? '#dbeafe'
                                                          : cell.getIsAggregated()
                                                            ? '#f0f0f0'
                                                            : undefined,
                                                    boxShadow: [
                                                        isTopEdge ? 'inset 0 2px 0 #2563eb' : '',
                                                        isBottomEdge ? 'inset 0 -2px 0 #2563eb' : '',
                                                        isLeftEdge ? 'inset 2px 0 0 #2563eb' : '',
                                                        isRightEdge ? 'inset -2px 0 0 #2563eb' : '',
                                                        isFillPreview ? 'inset 0 0 0 1px #60a5fa' : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(', '),
                                                    ...(isFrozen
                                                        ? {
                                                              position: 'sticky',
                                                              left: GUTTER_WIDTH,
                                                              background: isSelected ? '#dbeafe' : rowBg,
                                                          }
                                                        : {}),
                                                    ...(isEditing ? { zIndex: 20, overflow: 'visible' } : {}),
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
                                                    fieldDefs[colId]?.fieldType === 'single_select' ? (
                                                        <SingleSelectEditor
                                                            options={fieldDefs[colId]?.config?.options ?? []}
                                                            value={(row.original as any)?.[colId] ?? null}
                                                            onCommit={rawValue => commitEdit(dataIdx, colId, rawValue)}
                                                            onCancel={cancelEditing}
                                                        />
                                                    ) : (
                                                        <input
                                                            autoFocus
                                                            defaultValue={getCellText(
                                                                colId,
                                                                (row.original as any)?.[colId]
                                                            )}
                                                            onBlur={e => commitEdit(dataIdx, colId, e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    (e.target as HTMLInputElement).blur();
                                                                    e.stopPropagation();
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    cancelEditing();
                                                                    e.stopPropagation();
                                                                }
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                font: 'inherit',
                                                            }}
                                                        />
                                                    )
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
                                                    <>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        {normalizedSelection != null &&
                                                        visualIdx === normalizedSelection.bottomRow &&
                                                        colIndex === normalizedSelection.rightCol &&
                                                        !editing &&
                                                        !grouping.length ? (
                                                            <div
                                                                title="Drag to fill"
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    if (!normalizedSelection) return;
                                                                    tableContainerRef.current?.focus();
                                                                    isFillDraggingRef.current = true;
                                                                    pointerRef.current = { x: e.clientX, y: e.clientY };
                                                                    setFillDrag({
                                                                        source: normalizedSelection,
                                                                        target: normalizedSelection,
                                                                        axis: 'row',
                                                                    });
                                                                }}
                                                                style={{
                                                                    position: 'absolute',
                                                                    width: 8,
                                                                    height: 8,
                                                                    right: -4,
                                                                    bottom: -4,
                                                                    background: '#2563eb',
                                                                    border: '1px solid #fff',
                                                                    zIndex: 6,
                                                                    cursor: 'crosshair',
                                                                }}
                                                            />
                                                        ) : null}
                                                    </>
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
                    <em>
                        edit log: focus a cell and press Enter (or double-click) to edit, including category option
                        picks
                    </em>
                ) : (
                    editLog.map((m, i) => <div key={i}>{m}</div>)
                )}
            </div>
        </div>
    );
};

export default SandboxTanStack;
