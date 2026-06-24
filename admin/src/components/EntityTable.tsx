import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'

type EntityTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  globalFilterPlaceholder?: string
  hideToolbar?: boolean
  /** When set, each body row opens the detail view (click or Enter / Space). */
  onRowClick?: (row: T) => void
  enableRowSelection?: boolean
  getRowId?: (row: T) => string
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  bulkActions?: ReactNode
}

export function EntityTable<T>({
  columns,
  data,
  globalFilterPlaceholder = 'Search…',
  hideToolbar = false,
  onRowClick,
  enableRowSelection = false,
  getRowId,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  bulkActions,
}: EntityTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({})
  const rowSelection = controlledRowSelection ?? internalRowSelection

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next =
      typeof updater === 'function' ? updater(rowSelection) : updater
    if (onRowSelectionChange) {
      onRowSelectionChange(next)
    } else {
      setInternalRowSelection(next)
    }
  }

  const tableColumns = useMemo((): ColumnDef<T, unknown>[] => {
    if (!enableRowSelection) return columns
    const selectCol: ColumnDef<T, unknown> = {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all on page"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) {
              el.indeterminate =
                table.getIsSomePageRowsSelected() &&
                !table.getIsAllPageRowsSelected()
            }
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Select row"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    }
    return [selectCol, ...columns]
  }, [columns, enableRowSelection])

  const table = useReactTable<T>({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      ...(enableRowSelection ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    ...(enableRowSelection
      ? {
          enableRowSelection: true,
          onRowSelectionChange: handleRowSelectionChange,
          getRowId: getRowId ?? ((_unused: T, index: number) => String(index)),
        }
      : {}),
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
  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="table-wrap">
      {hideToolbar ? null : (
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
      )}
      {enableRowSelection && selectedCount > 0 && bulkActions ? (
        <div className="table-bulk-actions">{bulkActions}</div>
      ) : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : header.id ===
                      'select' ? (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    ) : (
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
                    ? (e) => {
                        const target = e.target as HTMLElement
                        if (
                          target.closest('input[type="checkbox"]') ||
                          target.closest('button')
                        ) {
                          return
                        }
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
          {enableRowSelection && selectedCount > 0
            ? ` · ${selectedCount} selected`
            : ''}
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
