'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, Filter, X } from 'lucide-react';

/** A filter dropdown definition */
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
}

/** A column definition */
export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterKey?: string; // key used for filtering (defaults to `key`)
  dateField?: boolean; // if true, render a date range filter for this column
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: string[];
  dateField?: string; // key of the date field in the row data (timestamp or ISO string)
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  className?: string;
  filters?: FilterDef[];
  onRowClick?: (row: T) => void;
  /** Extra toolbar content inserted after filters */
  extraToolbar?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Search…',
  searchKeys = [],
  dateField,
  pageSize: defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'No records found.',
  className = '',
  filters = [],
  onRowClick,
  extraToolbar,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPageSize);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Reset to page 1 when any filter changes
  const resetPage = useCallback(() => setCurrentPage(1), []);

  // Sorting
  const handleSort = useCallback((key: string) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  // Filter + search + date range + sort
  const filteredData = useMemo(() => {
    let result = [...data];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const keys = searchKeys.length > 0 ? searchKeys : columns.map(c => c.key);
      result = result.filter(row =>
        keys.some(k => {
          const val = row[k];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Dropdown filters
    Object.entries(activeFilters).forEach(([filterKey, filterVal]) => {
      if (filterVal && filterVal !== 'all') {
        result = result.filter(row => String(row[filterKey] || '').toLowerCase() === filterVal.toLowerCase());
      }
    });

    // Date range filter
    if (dateField && (dateFrom || dateTo)) {
      result = result.filter(row => {
        const raw = row[dateField];
        if (!raw) return false;
        const ts = typeof raw === 'number' ? raw : new Date(raw).getTime();
        if (isNaN(ts)) return false;
        if (dateFrom) {
          const from = new Date(dateFrom).getTime();
          if (ts < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo).getTime() + 86400000; // include entire end day
          if (ts > to) return false;
        }
        return true;
      });
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, searchQuery, searchKeys, columns, activeFilters, dateFrom, dateTo, dateField, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safePage - 1) * perPage, safePage * perPage);

  const activeFilterCount = Object.values(activeFilters).filter(v => v && v !== 'all').length
    + (dateFrom ? 1 : 0)
    + (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    resetPage();
  };

  return (
    <div className={className}>
      {/* Search + Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary, #94a3b8)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
            placeholder={searchPlaceholder}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              borderRadius: '10px',
              border: '1.5px solid var(--border-color, #e2e8f0)',
              backgroundColor: 'var(--bg-input, #f8fafc)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Dropdown filters */}
        {filters.map(f => (
          <select
            key={f.key}
            value={activeFilters[f.key] || 'all'}
            onChange={e => { setActiveFilters(prev => ({ ...prev, [f.key]: e.target.value })); resetPage(); }}
            style={{
              padding: '0.55rem 0.65rem',
              borderRadius: '10px',
              border: '1.5px solid var(--border-color, #e2e8f0)',
              backgroundColor: 'var(--bg-input, #f8fafc)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '0.78rem',
              outline: 'none',
              minWidth: '120px',
            }}
          >
            <option value="all">{f.label}</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}

        {/* Date range */}
        {dateField && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-tertiary, #94a3b8)' }} />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); resetPage(); }}
              style={{
                padding: '0.5rem 0.55rem',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.78rem',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #94a3b8)' }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); resetPage(); }}
              style={{
                padding: '0.5rem 0.55rem',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.78rem',
                outline: 'none',
              }}
            />
          </div>
        )}

        {extraToolbar}

        {/* Clear filters */}
        {(searchQuery || activeFilterCount > 0) && (
          <button
            onClick={clearAllFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary, #64748b)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Row count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)' }}>
          {filteredData.length === data.length
            ? `${data.length} record${data.length !== 1 ? 's' : ''}`
            : `${filteredData.length} of ${data.length} records`
          }
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)' }}>Rows:</span>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); resetPage(); }}
            style={{
              padding: '0.3rem 0.4rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: 'var(--bg-input, #f8fafc)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '0.72rem',
              outline: 'none',
            }}
          >
            {pageSizeOptions.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-tertiary, #94a3b8)',
                    backgroundColor: 'var(--bg-card-secondary, #f8fafc)',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary, #94a3b8)',
                    fontSize: '0.85rem',
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: '1px solid var(--border-color, #f1f5f9)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(37,99,235,0.04))')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.6rem 0.75rem',
                        color: 'var(--text-primary, #0f172a)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '280px',
                      }}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)' }}>
            Page {safePage} of {totalPages}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              disabled={safePage <= 1}
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); }}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: safePage <= 1 ? 'transparent' : 'var(--bg-card, #fff)',
                color: safePage <= 1 ? 'var(--text-tertiary, #cbd5e1)' : 'var(--text-primary, #0f172a)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (safePage <= 4) {
                page = i + 1;
              } else if (safePage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = safePage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: page === safePage ? '1.5px solid #2563EB' : '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: page === safePage ? '#2563EB' : 'var(--bg-card, #fff)',
                    color: page === safePage ? '#fff' : 'var(--text-primary, #0f172a)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {page}
                </button>
              );
            })}
            <button
              disabled={safePage >= totalPages}
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); }}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: safePage >= totalPages ? 'transparent' : 'var(--bg-card, #fff)',
                color: safePage >= totalPages ? 'var(--text-tertiary, #cbd5e1)' : 'var(--text-primary, #0f172a)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
