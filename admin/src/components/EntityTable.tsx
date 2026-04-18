import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'

type EntityTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  globalFilterPlaceholder?: string
  /** When set, each body row opens the detail view (click or Enter / Space). */
  onRowClick?: (row: T) => void
}

export function EntityTable<T>({
  columns,
  data,
  globalFilterPlaceholder = 'Search…',
  onRowClick,
}: EntityTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
    globalFilterFn: 'includesString',
  })

  const rows = table.getRowModel().rows
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const total = table.getFilteredRowModel().rows.length

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <input
          type="search"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={globalFilterPlaceholder}
          aria-label="Filter table"
        />
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          {total} row{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="sort"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp size={14} strokeWidth={2.5} aria-hidden />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown size={14} strokeWidth={2.5} aria-hidden />
                        ) : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={
                  onRowClick ? 'data-table__row--clickable' : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                aria-label={onRowClick ? 'View row details' : undefined}
                onClick={
                  onRowClick
                    ? () => {
                        onRowClick(row.original)
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row.original)
                        }
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          Page {pageIndex + 1} of {Math.max(pageCount, 1)}
        </span>
        <div className="pager">
          <button
            type="button"
            className="btn--with-icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            Previous
          </button>
          <button
            type="button"
            className="btn--with-icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
