import { Button } from "@wellfit-emr/ui/components/button";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import { cn } from "@wellfit-emr/ui/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { EmptyState } from "./empty-state";

interface Column<T> {
  accessor: (row: T) => React.ReactNode;
  className?: string;
  header: string;
  id?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyDescription?: string;
  emptyTitle?: string;
  isLoading?: boolean;
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    onPageChange: (offset: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyTitle,
  emptyDescription,
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  if (!isLoading && data.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  const currentPage = pagination
    ? Math.floor(pagination.offset / pagination.limit) + 1
    : 1;
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 1;
  const columnKeys = columns.map((col) => col.id ?? col.header);
  const skeletonRows = [
    "skeleton-1",
    "skeleton-2",
    "skeleton-3",
    "skeleton-4",
    "skeleton-5",
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-auto border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {columns.map((col, columnIndex) => (
                <th
                  className={cn(
                    "px-3 py-2 text-left font-medium text-muted-foreground",
                    col.className
                  )}
                  key={columnKeys[columnIndex]}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? skeletonRows.map((rowKey) => (
                  <tr key={rowKey}>
                    {columns.map((_, columnIndex) => (
                      <td
                        className="px-3 py-2"
                        key={`${rowKey}-${columnKeys[columnIndex]}`}
                      >
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row) => (
                  <tr
                    className={cn(
                      "border-t transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-muted/50" : ""
                    )}
                    key={keyExtractor(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col, columnIndex) => (
                      <td
                        className={cn("px-3 py-2", col.className)}
                        key={`${keyExtractor(row)}-${columnKeys[columnIndex]}`}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-muted-foreground text-xs">
            Mostrando {pagination.offset + 1} -{" "}
            {Math.min(pagination.offset + pagination.limit, pagination.total)}{" "}
            de {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              disabled={currentPage <= 1}
              onClick={() => pagination.onPageChange(0)}
              size="icon-xs"
              variant="ghost"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              disabled={currentPage <= 1}
              onClick={() =>
                pagination.onPageChange(pagination.offset - pagination.limit)
              }
              size="icon-xs"
              variant="ghost"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="px-2 text-xs">
              {currentPage} / {totalPages}
            </span>
            <Button
              disabled={currentPage >= totalPages}
              onClick={() =>
                pagination.onPageChange(pagination.offset + pagination.limit)
              }
              size="icon-xs"
              variant="ghost"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              disabled={currentPage >= totalPages}
              onClick={() =>
                pagination.onPageChange((totalPages - 1) * pagination.limit)
              }
              size="icon-xs"
              variant="ghost"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
