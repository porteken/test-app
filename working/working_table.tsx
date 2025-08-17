"use client";

import { Pagination } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Header,
  type HeaderGroup,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
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
import React, { useCallback, useMemo, useState } from "react";

import { FilterPanel } from "../src/components/filter-panel";

function generateInitialState(configs: FilterConfig[]): FiltersState {
  const initialState: FiltersState = {};
  for (const config of configs) {
    initialState[config.key] = { search: "", selected: null };
  }
  return initialState;
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

function ReusableDataTableInner<T>({
  apiConfig,
  columnConfigs,
  containerStyle,
  filterConfigs,
  pageSize,
  tableStyle,
}: ReusableDataTableProperties<T>) {
  const [filters, setFilters] = useState<FiltersState>(() =>
    generateInitialState(filterConfigs)
  );
  const [debouncedFilters] = useDebouncedValue(filters, 300);
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

  const table = useReactTable({
    columns: columnConfigs,
    data: tableDataQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
  });

  if (tableDataQuery.isError) {
    return (
      <div
        style={{
          backgroundColor: "#ffebee",
          borderRadius: "4px",
          color: "#d32f2f",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h3>Error Loading Data</h3>
        <p>
          {tableDataQuery.error instanceof Error
            ? tableDataQuery.error.message
            : "Unknown error occurred"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          maxWidth: "100%",
          ...containerStyle,
        }}
      >
        <FilterPanel
          apiConfig={apiConfig}
          debouncedFilters={debouncedFilters}
          filterConfigs={filterConfigs}
          filters={filters}
          onClearFilters={handleClearFilters}
          onSearchChange={handleSearchChange}
          onSelectChange={handleSelectChange}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {tableDataQuery.isLoading && (
            <div
              style={{
                backgroundColor: "#f5f5f5",
                borderRadius: "4px",
                color: "#666",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              Loading data...
            </div>
          )}

          {!tableDataQuery.isLoading &&
            tableDataQuery.data?.data.length === 0 && (
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  color: "#666",
                  padding: "2rem",
                  textAlign: "center",
                }}
              >
                <h3>No Data Found</h3>
                <p>Try adjusting your filters to see results.</p>
              </div>
            )}

          {!tableDataQuery.isLoading &&
            tableDataQuery.data &&
            tableDataQuery.data.data.length > 0 && (
              <>
                <div
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "4px",
                    overflow: "hidden",
                    ...tableStyle,
                  }}
                >
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead style={{ backgroundColor: "#f5f5f5" }}>
                      {table
                        .getHeaderGroups()
                        .map((headerGroup: HeaderGroup<T>) => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map(
                              (header: Header<T, unknown>) => (
                                <th
                                  key={header.id}
                                  style={{
                                    borderBottom: "2px solid #e0e0e0",
                                    borderRight: "1px solid #e0e0e0",
                                    fontWeight: 600,
                                    padding: "0.75rem",
                                    textAlign: "left",

                                    ...(headerGroup.headers.at(-1) &&
                                      header.id ===
                                        headerGroup.headers.at(-1)!.id && {
                                        borderRight: "none",
                                      }),
                                  }}
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </th>
                              )
                            )}
                          </tr>
                        ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row: Row<T>) => (
                        <tr
                          key={row.id}
                          onMouseEnter={event => {
                            event.currentTarget.style.backgroundColor =
                              "#fafafa";
                          }}
                          onMouseLeave={event => {
                            event.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          style={{
                            backgroundColor: "transparent",
                            borderBottom: "1px solid #f0f0f0",
                            transition: "background-color 0.2s ease",
                          }}
                        >
                          {row
                            .getVisibleCells()
                            .map((cell: Cell<T, unknown>, index, array) => (
                              <td
                                key={cell.id}
                                style={{
                                  borderBottom: "1px solid #f0f0f0",
                                  borderRight: "1px solid #e0e0e0",
                                  padding: "0.75rem",

                                  ...(index === array.length - 1 && {
                                    borderRight: "none",
                                  }),
                                }}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "1rem",
                    }}
                  >
                    <Pagination
                      boundaries={1}
                      onChange={setCurrentPage}
                      siblings={1}
                      size="sm"
                      total={totalPages}
                      value={currentPage}
                      withEdges
                    />
                  </div>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
