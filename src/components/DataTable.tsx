import { css } from "@flairjs/client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

type DataTableProps<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  getRowId?: (row: T, index: number) => string;
  emptyMessage?: string;
};

function DataTable<T>({
  columns,
  data,
  getRowId,
  emptyMessage = "No data yet.",
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: T, index: number) => string) | undefined,
  });

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="table-head">
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
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

DataTable.flair = css`
  .table-wrap {
    overflow-x: auto;
    border-radius: $radii.card;
    border: 1px solid $colors.border;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .table-head {
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    font-weight: 600;
    color: $colors.text-muted;
    padding: 10px 14px;
    background-color: $colors.surface;
    border-bottom: 1px solid $colors.border;
    white-space: nowrap;
  }

  .table-row:not(:last-child) {
    border-bottom: 1px solid $colors.border;
  }

  .table-row:hover {
    background-color: $colors.surface;
  }

  .table-cell {
    padding: 10px 14px;
    vertical-align: middle;
    color: $colors.text;
  }

  .table-empty {
    padding: 24px 14px;
    text-align: center;
    color: $colors.text-muted;
  }
`;

export default DataTable;
