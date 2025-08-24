"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { FilterPanel } from "./filter-panel";
import {
  DeleteDialog,
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "./table-common"; // Assuming your new components are in 'table-common.tsx'

// -------------------- Types --------------------
export type InfiniteQueryPage<T> = {
  items: T[];
  nextPage?: number;
};

type ApiConfig = {
  baseUrl: string;
  defaultLimit?: number;
  endpoints: {
    data: string;
    delete?: string; // Endpoint for deletion, e.g., "/api/data"
    filters: string;
  };
};

type ApiResponse<T> = {
  data: T[];
  limit: number;
  next?: string;
  page: number;
  total: number;
};

type Entity = { id: string; name: string };

type Filter = { search: string; selected: Entity | null };

type FilterConfig = {
  apiField: string;
  key: string;
  label: string;
  placeholder: string;
};

type FiltersState = Record<string, Filter>;

type TablePaginationProperties<T> = {
  apiConfig: ApiConfig;
  columnConfigs: ColumnDef<T, string>[];
  enableDelete?: boolean; // Prop to conditionally enable delete functionality
  filterConfigs?: FilterConfig[];
  pageSize?: number;
  showDebugInfo?: boolean;
};

// -------------------- Constants --------------------
const DEFAULT_PAGE_SIZE = 50;
const DEBOUNCE_DELAY_MS = 300;
const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60 * 1000;
export const generatePaginationRange = (
  currentPage: number,
  totalPages: number
): (number | string)[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};
// -------------------- Helpers --------------------
const generateInitialState = (configs: FilterConfig[] = []): FiltersState => {
  const accumulator: FiltersState = {};
  for (const config of configs) {
    accumulator[config.key] = { search: "", selected: null };
  }
  return accumulator;
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export const fetchTableData = async <T,>(
  apiFilters: Record<string, string>,
  page: number,
  limit: number,
  apiConfig: ApiConfig
): Promise<{ data: T[]; hasMore: boolean; total: number }> => {
  const parameters = new URLSearchParams({
    limit: limit.toString(),
    page: page.toString(),
  });

  for (const [key, value] of Object.entries(apiFilters)) {
    if (value) {
      parameters.append(key, value);
    }
  }

  const url = `${apiConfig.baseUrl}${apiConfig.endpoints.data}?${parameters}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch table data: ${response.statusText}`);
  }

  const result: ApiResponse<T> = await response.json();
  return {
    data: result.data,
    hasMore: !!result.next,
    total: result.total || 0,
  };
};

// -------------------- Data Hook --------------------
const useTableData = <T,>(
  filters: FiltersState,
  filterConfigs: FilterConfig[] | undefined,
  apiConfig: ApiConfig,
  page: number,
  pageSize: number
) => {
  const apiFilters = useMemo(() => {
    const accumulator: Record<string, string> = {};
    if (filterConfigs) {
      for (const config of filterConfigs) {
        const selectedValue = filters[config.key]?.selected?.name;
        if (selectedValue) {
          accumulator[config.apiField] = selectedValue;
        }
      }
    }
    return accumulator;
  }, [filters, filterConfigs]);

  return useQuery({
    gcTime: GC_TIME_MS,
    queryFn: () => fetchTableData<T>(apiFilters, page, pageSize, apiConfig),
    queryKey: ["table-data", apiFilters, page, pageSize, apiConfig.baseUrl],
    staleTime: STALE_TIME_MS,
  });
};

// -------------------- Main Component --------------------
// Enforce that the generic data type `T` must have a string `id`
export function TablePagination<T extends { id: string }>({
  apiConfig,
  columnConfigs,
  enableDelete,
  filterConfigs,
  pageSize = DEFAULT_PAGE_SIZE,
}: TablePaginationProperties<T>) {
  const [filters, setFilters] = useState<FiltersState>(() =>
    generateInitialState(filterConfigs)
  );
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAY_MS);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // State to manage the delete dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<null | T>(null);

  const {
    data: tableData,
    error,
    isError,
    isLoading,
  } = useTableData<T>(
    debouncedFilters,
    filterConfigs,
    apiConfig,
    currentPage,
    pageSize
  );

  // Delete mutation logic is now encapsulated within the component
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const deleteEndpoint = apiConfig.endpoints.delete;
      const url = `${apiConfig.baseUrl}${deleteEndpoint}/${id}`;
      const response = await fetch(url, { method: "DELETE" });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to delete item with ID ${id}`
        );
      }
      return response.json();
    },
    onError: (error: Error) => {
      console.error("Deletion failed:", error.message);
      alert(`Failed to delete item: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-data"] });
      setIsDeleteDialogOpen(false);
      setRowToDelete(null);
    },
  });

  const handleOpenDeleteDialog = useCallback((row: T) => {
    setRowToDelete(row);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deleteMutation.isPending) return;
    setRowToDelete(null);
    setIsDeleteDialogOpen(false);
  }, [deleteMutation.isPending]);

  const handleConfirmDelete = useCallback(() => {
    if (rowToDelete) {
      deleteMutation.mutate(rowToDelete.id);
    }
  }, [rowToDelete, deleteMutation]);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  const handleSearchChange = useCallback((key: string, value: string) => {
    setFilters(previous => ({
      ...previous,
      [key]: { ...previous[key], search: value },
    }));
  }, []);

  const handleSelectChange = useCallback(
    (key: string, value: Entity | null) => {
      setFilters(previous => ({
        ...previous,
        [key]: { search: String(value?.name), selected: value },
      }));
      resetPage();
    },
    [resetPage]
  );

  const handleClearFilters = useCallback(() => {
    setFilters(generateInitialState(filterConfigs));
    resetPage();
  }, [filterConfigs, resetPage]);

  const totalPages = useMemo(
    () => (tableData ? Math.ceil(tableData.total / pageSize) : 0),
    [tableData, pageSize]
  );

  const paginationRange = useMemo(
    () => generatePaginationRange(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const finalColumns = useMemo(() => {
    if (!enableDelete) {
      return columnConfigs;
    }

    const actionColumn: ColumnDef<T, string> = {
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Open menu"
              className="h-8 w-8 p-0"
              variant="ghost"
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className={`
                text-red-600
                focus:bg-red-50 focus:text-red-700
              `}
              onClick={() => handleOpenDeleteDialog(row.original)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      header: () => null,
      id: "actions",
    };

    return [actionColumn, ...columnConfigs];
  }, [columnConfigs, enableDelete, handleOpenDeleteDialog]);

  const table = useReactTable({
    columns: finalColumns,
    data: tableData?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
  });

  const handlePageChange = useCallback(
    (page: number) => {
      if (page > 0 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  // -------------------- Render --------------------
  if (isError) {
    return <TableErrorState error={error} retry={() => setCurrentPage(1)} />;
  }

  const rowCount = tableData?.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {filterConfigs && filterConfigs.length > 0 && (
        <FilterPanel
          apiConfig={apiConfig}
          debouncedFilters={debouncedFilters}
          filterConfigs={filterConfigs}
          filters={filters}
          onClearFilters={handleClearFilters}
          onSearchChange={handleSearchChange}
          onSelectChange={handleSelectChange}
        />
      )}

      <div className="space-y-4">
        {isLoading && <TableLoadingState />}

        {!isLoading && rowCount === 0 && <TableEmptyState />}

        {!isLoading && rowCount > 0 && (
          <>
            <div className="rounded-lg border">
              <Table aria-label="table">
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <TableHead key={header.id}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(row => (
                    <TableRow data-state={row.getIsSelected()} key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        aria-disabled={currentPage === 1}
                        aria-label="Go to previous page"
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                        href="#"
                        onClick={event_ => {
                          event_.preventDefault();
                          if (currentPage !== 1) {
                            handlePageChange(currentPage - 1);
                          }
                        }}
                        tabIndex={currentPage === 1 ? -1 : 0}
                      />
                    </PaginationItem>
                    {paginationRange.map((page, index) =>
                      typeof page === "string" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem
                          aria-label={`Go to page ${page}`}
                          key={page}
                        >
                          <PaginationLink
                            href="#"
                            isActive={currentPage === page}
                            onClick={event_ => {
                              event_.preventDefault();
                              handlePageChange(page);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        aria-disabled={currentPage === totalPages}
                        aria-label="Go to next page"
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                        href="#"
                        onClick={event_ => {
                          event_.preventDefault();
                          if (currentPage !== totalPages) {
                            handlePageChange(currentPage + 1);
                          }
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      <DeleteDialog
        isDeleting={deleteMutation.isPending}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        open={isDeleteDialogOpen}
      />
    </div>
  );
}
