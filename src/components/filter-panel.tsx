"use client";

import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/* -------------------- Types -------------------- */

export type ApiConfig = {
  baseUrl: string;
  defaultLimit?: number;
  endpoints: {
    data: string;
    filters: string;
  };
};

export type ApiResponse<T = string> = {
  data: T[];
  limit: number;
  next?: string;
  page: number;
  total: number;
};

export type Entity = {
  id: string;
  name: string;
};

export type Filter = {
  search: string;
  selected: Entity | null;
};

export type FilterConfig = {
  apiField: string;
  key: string;
  label: string;
  placeholder: string;
};

export type FiltersState = Record<string, Filter>;

export type InfiniteQueryPage<TItem extends Entity = Entity> = {
  items: TItem[];
  nextPage?: number;
};

/* -------------------- Infinite Select -------------------- */

export type InfiniteSearchableSelectProperties<TData extends Entity> = {
  data: InfiniteData<InfiniteQueryPage<TData>> | undefined;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  itemToId: (item: TData) => string;
  itemToName: (item: TData) => string;
  label: string;
  onValueChange: (value: null | TData) => void;
  placeholder: string;
  search: string;
  selectedValue: null | TData;
  setSearch: (search: string) => void;
};

export function InfiniteSearchableSelect<TData extends Entity>({
  data,
  fetchNextPage,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  itemToId,
  itemToName,
  label,
  onValueChange,
  placeholder,
  search,
  selectedValue,
  setSearch,
}: InfiniteSearchableSelectProperties<TData>) {
  const [open, setOpen] = useState(false);

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data]
  );

  const { inView, ref: intersectionReference } = useInView({ threshold: 1 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  const handleSelect = useCallback(
    (item: TData) => {
      onValueChange(item);
      setSearch(itemToName(item));
      setOpen(false);
    },
    [onValueChange, setSearch, itemToName]
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className="w-full justify-between"
            role="combobox"
            variant="outline"
          >
            {selectedValue ? itemToName(selectedValue) : placeholder}
            {isFetching && !isFetchingNextPage ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-70" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={value => {
                setSearch(value);
                if (value === "") {
                  onValueChange(null);
                }
              }}
              placeholder={placeholder}
              value={search}
            />
            <CommandList className="max-h-52">
              {isError && (
                <CommandEmpty className="text-red-500">
                  Error fetching data
                </CommandEmpty>
              )}

              {!isError && allItems.length === 0 && !isFetching && (
                <CommandEmpty>Nothing found</CommandEmpty>
              )}

              <CommandGroup>
                {allItems.map(item => (
                  <CommandItem
                    key={itemToId(item)}
                    onSelect={() => handleSelect(item)}
                    value={itemToId(item)}
                  >
                    {itemToName(item)}
                  </CommandItem>
                ))}

                {hasNextPage && (
                  <div className="h-1" ref={intersectionReference} />
                )}

                {isFetchingNextPage && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* -------------------- Data Fetching -------------------- */

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
  const items: Entity[] = data.data.map(item => ({
    id: String(item),
    name: String(item),
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

/* -------------------- Configurable Select -------------------- */

interface ConfigurableSelectProperties {
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
}

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
  }: ConfigurableSelectProperties) => (
    <InfiniteSearchableSelect
      data={data}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      isError={isError}
      isFetching={isFetching}
      isFetchingNextPage={isFetchingNextPage}
      itemToId={(item: Entity) => item.id}
      itemToName={(item: Entity) => item.name}
      label={config.label}
      onValueChange={(value: Entity | null) =>
        onSelectChange(config.key, value)
      }
      placeholder={config.placeholder}
      search={search}
      selectedValue={selectedValue}
      setSearch={value => onSearchChange(config.key, value)}
    />
  )
);

ConfigurableSelect.displayName = "ConfigurableSelect";

/* -------------------- Filter Panel -------------------- */

interface FilterPanelProperties {
  apiConfig: ApiConfig;
  debouncedFilters: FiltersState;
  filterConfigs: FilterConfig[];
  filters: FiltersState;
  onClearFilters: () => void;
  onSearchChange: (key: string, value: string) => void;
  onSelectChange: (key: string, value: Entity | null) => void;
}

export const FilterPanel = ({
  apiConfig,
  debouncedFilters,
  filterConfigs,
  filters,
  onClearFilters,
  onSearchChange,
  onSelectChange,
}: FilterPanelProperties) => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0">Filters</h2>

      <div className="flex flex-row flex-wrap items-end gap-4">
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
        <Button onClick={onClearFilters} variant="outline">
          Clear All
        </Button>
      </div>
    </div>
  );
};
