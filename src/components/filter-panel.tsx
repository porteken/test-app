"use client";

import { Button } from "@mantine/core";
import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import { InfiniteSearchableSelect } from "./infinite-select";

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

type InfiniteQueryPage = {
  items: Entity[];
  nextPage?: number;
};

const fetchFilterOptions = async (
  fieldName: string,
  apiFilters: Record<string, string> = {},
  searchQuery = "",
  pageParameter = 1,
  apiConfig: ApiConfig
): Promise<InfiniteQueryPage> => {
  const parameters = new URLSearchParams({
    limit: (apiConfig.defaultLimit || 20).toString(),
    name: fieldName,
    page: pageParameter.toString(),
  });

  for (const [key, value] of Object.entries(apiFilters)) {
    if (value && key !== fieldName) {
      parameters.append(key, value);
    }
  }

  if (searchQuery) {
    parameters.append(fieldName, searchQuery);
  }

  const url = `${apiConfig.baseUrl}${apiConfig.endpoints.filters}?${parameters}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${fieldName} options: ${response.statusText}`
    );
  }

  const data: ApiResponse = await response.json();
  const items: Entity[] = (data.data as string[]).map(name => ({
    id: name,
    name,
  }));

  return {
    items,
    nextPage: data.next ? data.page + 1 : undefined,
  };
};

const useFilterOptions = (
  currentFilterKey: string,
  allFilters: FiltersState,
  apiConfig: ApiConfig,
  filterConfigs: FilterConfig[]
) => {
  const currentConfig = filterConfigs.find(c => c.key === currentFilterKey);

  const apiFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    for (const facet of filterConfigs) {
      if (facet.key !== currentFilterKey && allFilters[facet.key]?.selected) {
        filters[facet.apiField] = allFilters[facet.key].selected!.name;
      }
    }
    return filters;
  }, [allFilters, currentFilterKey, filterConfigs]);

  const searchQuery = allFilters[currentFilterKey]?.search || "";

  return useInfiniteQuery<InfiniteQueryPage, Error>({
    enabled: !!currentConfig,
    gcTime: 5 * 60 * 1000,
    getNextPageParam: lastPage => lastPage.nextPage,
    initialPageParam: 1,
    queryFn: async ({ pageParam: pageParameter = 1 }) => {
      if (!currentConfig) {
        throw new Error(`Missing config for filter: ${currentFilterKey}`);
      }
      return await fetchFilterOptions(
        currentConfig.apiField,
        apiFilters,
        searchQuery,
        pageParameter as number,
        apiConfig
      );
    },
    queryKey: [
      "filter-options",
      currentFilterKey,
      currentConfig?.apiField,
      apiFilters,
      searchQuery,
      apiConfig.baseUrl,
    ],
    staleTime: 30_000,
  });
};

const ConfigurableSelect = React.memo(
  ({
    config,
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
    onSearchChange,
    onSelectChange,
    search,
    selectedValue,
  }: {
    config: FilterConfig;
    data: InfiniteData<InfiniteQueryPage> | undefined;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isError: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    onSearchChange: (key: string, value: string) => void;
    onSelectChange: (key: string, value: Entity | null) => void;
    search: string;
    selectedValue: Entity | null;
  }) => (
    <InfiniteSearchableSelect
      data={data}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      isError={isError}
      isFetching={isFetching}
      isFetchingNextPage={isFetchingNextPage}
      itemToId={item => item.id}
      itemToName={item => item.name}
      label={config.label}
      onValueChange={value =>
        onSelectChange(config.key, value as Entity | null)
      }
      placeholder={config.placeholder}
      search={search}
      selectedValue={selectedValue}
      setSearch={value => onSearchChange(config.key, value)}
    />
  )
);

ConfigurableSelect.displayName = "ConfigurableSelect";

type FilterPanelProperties = {
  apiConfig: ApiConfig;
  debouncedFilters: FiltersState;
  filterConfigs: FilterConfig[];
  filters: FiltersState;
  onClearFilters: () => void;
  onSearchChange: (key: string, value: string) => void;
  onSelectChange: (key: string, value: Entity | null) => void;
};

export function FilterPanel({
  apiConfig,
  debouncedFilters,
  filterConfigs,
  filters,
  onClearFilters,
  onSearchChange,
  onSelectChange,
}: FilterPanelProperties) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h2 style={{ margin: 0 }}>Filters</h2>

      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {filterConfigs.map(config => {
          const filterQuery = useFilterOptions(
            config.key,
            debouncedFilters,
            apiConfig,
            filterConfigs
          );

          return (
            <ConfigurableSelect
              config={config}
              data={filterQuery.data}
              fetchNextPage={filterQuery.fetchNextPage}
              hasNextPage={filterQuery.hasNextPage ?? false}
              isError={filterQuery.isError}
              isFetching={filterQuery.isFetching}
              isFetchingNextPage={filterQuery.isFetchingNextPage}
              key={config.key}
              onSearchChange={onSearchChange}
              onSelectChange={onSelectChange}
              search={filters[config.key].search}
              selectedValue={filters[config.key].selected}
            />
          );
        })}
        <Button onClick={onClearFilters}>Clear All</Button>
      </div>
    </div>
  );
}
