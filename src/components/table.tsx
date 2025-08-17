"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type HeaderGroup,
  type Row,
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

// Type Definitions
export type InfiniteQueryPage = {
  items: Entity[];
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

type ApiResponse<T = any> = {
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

type ReusableDataTableProperties<T = any> = {
  apiConfig: ApiConfig;
  columnConfigs: TableColumn<T>[];
  containerStyle?: React.CSSProperties;
  filterConfigs: FilterConfig[];
  pageSize?: number;
  queryClient?: QueryClient;
  showDebugInfo?: boolean;
  tableStyle?: React.CSSProperties;
  title?: string;
};

type TableColumn<T> = ColumnDef<T, any>;

// Helper Functions
function generateInitialState(configs: FilterConfig[]): FiltersState {
  const initialState: FiltersState = {};
  for (const config of configs) {
    initialState[config.key] = { search: "", selected: null };
  }
  return initialState;
}

// Custom Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const fetchTableData = async <T,>(
  apiFilters: Record<string, string> = {},
  page = 1,
  limit = 50,
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
    data: result.data as T[],
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

// Custom Hook for Data Fetching
const useTableData = <T,>(
  filters: FiltersState,
  filterConfigs: FilterConfig[],
  apiConfig: ApiConfig,
  page: number = 1,
  pageSize: number = 50
) => {
  const apiFilters = useMemo(() => {
    const filtersObject: Record<string, string> = {};
    for (const config of filterConfigs) {
      const selectedValue = filters[config.key]?.selected?.name;
      if (selectedValue) {
        filtersObject[config.apiField] = selectedValue;
      }
    }
    return filtersObject;
  }, [filters, filterConfigs]);

  return useQuery({
    gcTime: 5 * 60 * 1000,
    queryFn: async () =>
      await fetchTableData<T>(apiFilters, page, pageSize, apiConfig),
    queryKey: ["table-data", apiFilters, page, pageSize, apiConfig.baseUrl],
    staleTime: 30_000,
  });
};

// Main Component Wrapper
export function ReusableDataTable<T = any>({
  apiConfig,
  columnConfigs,
  containerStyle,
  filterConfigs,
  pageSize = 50,
  queryClient: providedQueryClient,
  tableStyle,
  title = "Data Results",
}: ReusableDataTableProperties<T>) {
  const defaultQueryClient = useMemo(() => new QueryClient(), []);
  const queryClient = providedQueryClient || defaultQueryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <ReusableDataTableInner<T>
        apiConfig={apiConfig}
        columnConfigs={columnConfigs}
        containerStyle={containerStyle}
        filterConfigs={filterConfigs}
        pageSize={pageSize}
        tableStyle={tableStyle}
        title={title}
      />
    </QueryClientProvider>
  );
}

// Inner Component with Logic
function ReusableDataTableInner<T>({
  apiConfig,
  columnConfigs,
  filterConfigs,
  pageSize,
}: ReusableDataTableProperties<T>) {
  const [filters, setFilters] = useState<FiltersState>(() =>
    generateInitialState(filterConfigs)
  );
  const debouncedFilters = useDebounce(filters, 300);
  const [currentPage, setCurrentPage] = useState(1);

  const tableDataQuery = useTableData<T>(
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
    () =>
      tableDataQuery.data
        ? Math.ceil(tableDataQuery.data.total / pageSize!)
        : 0,
    [tableDataQuery.data, pageSize]
  );

  const paginationRange = useMemo(
    () => generatePaginationRange(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const table = useReactTable({
    columns: columnConfigs,
    data: tableDataQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
  });

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (tableDataQuery.isError) {
    return (
      <Alert className="max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div>
            <strong>Error loading data</strong>
            <p>
              {tableDataQuery.error instanceof Error
                ? tableDataQuery.error.message
                : "An unknown error occurred"}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <FilterPanel
        apiConfig={apiConfig}
        debouncedFilters={debouncedFilters}
        filterConfigs={filterConfigs}
        filters={filters}
        onClearFilters={handleClearFilters}
        onSearchChange={handleSearchChange}
        onSelectChange={handleSelectChange}
      />

      <div className="space-y-4">
        {tableDataQuery.isLoading && (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-gray-600">Loading data...</p>
          </div>
        )}

        {!tableDataQuery.isLoading &&
          tableDataQuery.data?.data.length === 0 && (
            <Alert>
              <AlertDescription>
                <div>
                  <strong>No data available</strong>
                  <p>Try adjusting your filters to see results.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

        {!tableDataQuery.isLoading &&
          tableDataQuery.data &&
          tableDataQuery.data.data.length > 0 && (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    {table
                      .getHeaderGroups()
                      .map((headerGroup: HeaderGroup<T>) => (
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
                      table.getRowModel().rows.map((row: Row<T>) => (
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
                          href="#"
                          onClick={event => {
                            event.preventDefault();
                            handlePageChange(currentPage - 1);
                          }}
                        />
                      </PaginationItem>
                      {paginationRange.map((page, index) => {
                        if (typeof page === "string") {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={event => {
                                event.preventDefault();
                                handlePageChange(page);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={event => {
                            event.preventDefault();
                            handlePageChange(currentPage + 1);
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
    </div>
  );
}
