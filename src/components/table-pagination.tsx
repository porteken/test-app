"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircle, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

type ReusableDataTableProperties<T> = {
  apiConfig: ApiConfig;
  columnConfigs: ColumnDef<T, any>[];
  filterConfigs: FilterConfig[];
  pageSize?: number;
  queryClient?: QueryClient;
  showDebugInfo?: boolean;
  title?: string;
};

// -------------------- Constants --------------------
const DEFAULT_PAGE_SIZE = 50;
const DEBOUNCE_DELAY_MS = 300;
const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60 * 1000;

// -------------------- Helpers --------------------
const generateInitialState = (configs: FilterConfig[]): FiltersState => {
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

const fetchTableData = async <T,>(
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

const generatePaginationRange = (
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

// -------------------- Data Hook --------------------
const useTableData = <T,>(
  filters: FiltersState,
  filterConfigs: FilterConfig[],
  apiConfig: ApiConfig,
  page: number,
  pageSize: number
) => {
  const apiFilters = useMemo(() => {
    const accumulator: Record<string, string> = {};
    for (const config of filterConfigs) {
      const selectedValue = filters[config.key]?.selected?.name;
      if (selectedValue) {
        accumulator[config.apiField] = selectedValue;
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
export function ReusableDataTable<T>({
  apiConfig,
  columnConfigs,
  filterConfigs,
  pageSize = DEFAULT_PAGE_SIZE,
  title,
}: ReusableDataTableProperties<T>) {
  const [filters, setFilters] = useState<FiltersState>(() =>
    generateInitialState(filterConfigs)
  );
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAY_MS);
  const [currentPage, setCurrentPage] = useState(1);

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
        [key]: { search: value?.name ?? "", selected: value },
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

  const table = useReactTable({
    columns: columnConfigs,
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
    return (
      <Alert className="max-w-2xl" variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Error loading data</strong>
          <p>
            {error instanceof Error
              ? error.message
              : "An unknown error occurred"}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-gray-600">Loading data...</p>
        </div>
      );
    }

    if (!tableData?.data.length) {
      return (
        <Alert>
          <AlertDescription>
            <strong>No data available</strong>
            <p>Try adjusting your filters to see results.</p>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    key={row.id}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-24 text-center"
                    colSpan={columnConfigs.length}
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
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
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
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
                    <PaginationItem key={page}>
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
    );
  };

  return (
    <div className="space-y-6">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}

      <FilterPanel
        apiConfig={apiConfig}
        debouncedFilters={debouncedFilters}
        filterConfigs={filterConfigs}
        filters={filters}
        onClearFilters={handleClearFilters}
        onSearchChange={handleSearchChange}
        onSelectChange={handleSelectChange}
      />

      <div className="space-y-4">{renderTableContent()}</div>
    </div>
  );
}
