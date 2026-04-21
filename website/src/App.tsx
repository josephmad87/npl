import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import './App.css'

type TeamStat = {
  team: string
  played: number
  points: number
  netRunRate: number
}

const fetchStandings = async (): Promise<TeamStat[]> => {
  return Promise.resolve([
    { team: 'Eagles', played: 8, points: 14, netRunRate: 1.24 },
    { team: 'Rhinos', played: 8, points: 12, netRunRate: 0.8 },
    { team: 'Lions', played: 8, points: 10, netRunRate: 0.31 },
    { team: 'Panthers', played: 8, points: 8, netRunRate: -0.15 },
  ])
}

const columnHelper = createColumnHelper<TeamStat>()
const columns = [
  columnHelper.accessor('team', {
    header: 'Team',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('played', {
    header: 'Played',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('points', {
    header: 'Points',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('netRunRate', {
    header: 'NRR',
    cell: (info) => info.getValue().toFixed(2),
  }),
]

function App() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['standings'],
    queryFn: fetchStandings,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <main className="container">
      <h1>NPL Website Starter</h1>
      <p className="subtitle">
        React + Vite + TypeScript with TanStack Router, Query, and Table
      </p>

      {isLoading ? <p>Loading standings...</p> : null}
      {isError ? <p>Could not load standings.</p> : null}

      {!isLoading && !isError ? (
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  )
}

export default App
