"use client";

import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2, X } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useDebouncedCallback } from "use-debounce";

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
  required?: boolean;
};

export type FiltersState = Record<string, Filter>;

export type InfiniteQueryPage<TItem extends Entity = Entity> = {
  items: TItem[];
  nextPage?: number;
};

/* -------------------- Custom Hooks -------------------- */

const useDebounce = <T,>(value: T, delay: number): T => {
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
};

/* -------------------- Infinite Select -------------------- */

export type InfiniteSearchableSelectProperties<TData extends Entity> = {
  data: InfiniteData<InfiniteQueryPage<TData>> | undefined;
  disabled?: boolean;
  error?: string;
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
  required?: boolean;
  search: string;
  selectedValue: null | TData;
  setSearch: (search: string) => void;
};

export function InfiniteSearchableSelect<TData extends Entity>({
  data,
  disabled = false,
  error,
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
  required = false,
  search,
  selectedValue,
  setSearch,
}: InfiniteSearchableSelectProperties<TData>) {
  const [open, setOpen] = useState(false);
  const commandListReference = useRef<HTMLDivElement>(null);

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data]
  );

  const { inView, ref: intersectionReference } = useInView({
    rootMargin: "100px",
    threshold: 0.1,
  });

  // Debounce the infinite loading to prevent excessive API calls
  const debouncedFetchNext = useDebouncedCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, 300);

  useEffect(() => {
    if (inView) {
      debouncedFetchNext();
    }
  }, [inView, debouncedFetchNext]);

  const handleSelect = useCallback(
    (item: TData) => {
      onValueChange(item);
      setSearch(itemToName(item));
      setOpen(false);
    },
    [onValueChange, setSearch, itemToName]
  );

  const handleClear = useCallback(
    (event_: React.MouseEvent) => {
      event_.preventDefault();
      event_.stopPropagation();
      onValueChange(null);
      setSearch("");
    },
    [onValueChange, setSearch]
  );

  const handleKeyDown = useCallback((event_: React.KeyboardEvent) => {
    if (event_.key === "Escape") {
      setOpen(false);
    }
  }, []);

  // Reset scroll position when search changes
  useEffect(() => {
    if (commandListReference.current) {
      commandListReference.current.scrollTop = 0;
    }
  }, [search]);

  const hasValidItems = allItems.length > 0;
  const showError = isError || !!error;
  const showEmpty =
    !showError && !hasValidItems && !isFetching && search.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`
          text-sm font-medium
          ${required ? "after:ml-1 after:text-red-500 after:content-['*']" : ""}
        `}
      >
        {label}
      </label>

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-invalid={showError}
            className={`
              w-full justify-between
              ${
                showError
                  ? `
                    border-red-500
                    focus:border-red-500
                  `
                  : ""
              }
            `}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            role="combobox"
            variant="outline"
          >
            <span className="truncate">
              {selectedValue ? itemToName(selectedValue) : placeholder}
            </span>

            <div className="ml-2 flex items-center gap-1">
              {selectedValue && !disabled && (
                <span
                  className={`
                    flex h-4 w-4 cursor-pointer items-center justify-center rounded p-0
                    hover:bg-gray-100
                  `}
                  onClick={handleClear}
                  onKeyDown={event_ => {
                    if (event_.key === "Enter" || event_.key === " ") {
                      event_.preventDefault();
                      handleClear(event_ as any);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <X className="h-3 w-3" />
                </span>
              )}

              {isFetching && !isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin opacity-70" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              )}
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
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

            <CommandList className="max-h-52" ref={commandListReference}>
              {showError && (
                <CommandEmpty className="text-red-500">
                  {error || "Error fetching data"}
                </CommandEmpty>
              )}

              {showEmpty && <CommandEmpty>No results found</CommandEmpty>}

              {hasValidItems && (
                <CommandGroup>
                  {allItems.map(item => (
                    <CommandItem
                      className="cursor-pointer"
                      key={itemToId(item)}
                      onSelect={() => handleSelect(item)}
                      value={itemToId(item)}
                    >
                      <span className="truncate">{itemToName(item)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasNextPage && (
                <div className="h-4" ref={intersectionReference} />
              )}

              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showError && error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

/* -------------------- Data Fetching -------------------- */

const fetchFilterOptions = async (
  fieldName: string,
  apiFilters: Record<string, string> = {},
  searchQuery = "",
  pageParameter = 1,
  apiConfig: ApiConfig,
  signal?: AbortSignal
): Promise<InfiniteQueryPage> => {
  const parameters = new URLSearchParams({
    limit: (apiConfig.defaultLimit || 20).toString(),
    name: fieldName,
    page: pageParameter.toString(),
  });

  // Only add non-empty filter values
  for (const [key, value] of Object.entries(apiFilters)) {
    if (value && key !== fieldName) {
      parameters.append(key, value);
    }
  }

  if (searchQuery.trim()) {
    parameters.append(fieldName, searchQuery.trim());
  }

  const url = `${apiConfig.baseUrl}${apiConfig.endpoints.filters}?${parameters}`;

  try {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${fieldName} options: ${response.status} ${response.statusText}`
      );
    }

    const data: ApiResponse = await response.json();

    // Ensure data is always an array
    const items: Entity[] = (Array.isArray(data.data) ? data.data : []).map(
      item => ({
        id: String(item),
        name: String(item),
      })
    );

    return {
      items,
      nextPage: data.next ? data.page + 1 : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new Error(`Network error while fetching ${fieldName}: ${error}`);
  }
};

const useFilterOptions = (
  currentFilterKey: string,
  allFilters: FiltersState,
  apiConfig: ApiConfig,
  filterConfigs: FilterConfig[]
) => {
  const currentConfig = useMemo(
    () => filterConfigs.find(c => c.key === currentFilterKey),
    [filterConfigs, currentFilterKey]
  );

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
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  return useInfiniteQuery<InfiniteQueryPage, Error>({
    enabled: !!currentConfig,
    gcTime: 5 * 60 * 1000,
    getNextPageParam: lastPage => lastPage.nextPage,
    initialPageParam: 1,
    queryFn: async ({ pageParam: pageParameter = 1, signal }) => {
      if (!currentConfig) {
        throw new Error(`Missing config for filter: ${currentFilterKey}`);
      }
      return fetchFilterOptions(
        currentConfig.apiField,
        apiFilters,
        debouncedSearchQuery,
        pageParameter as number,
        apiConfig,
        signal
      );
    },
    queryKey: [
      "filter-options",
      currentFilterKey,
      currentConfig?.apiField,
      apiFilters,
      debouncedSearchQuery,
      apiConfig.baseUrl,
    ],
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error.message.includes("4")) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 2 * 60 * 1000, // Increased stale time
  });
};

/* -------------------- Configurable Select -------------------- */

interface ConfigurableSelectProperties {
  config: FilterConfig;
  data: InfiniteData<InfiniteQueryPage> | undefined;
  disabled?: boolean;
  error?: string;
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
    disabled = false,
    error,
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
      disabled={disabled}
      error={error}
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
      required={config.required}
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
  disabled?: boolean;
  errors?: Record<string, string>;
  filterConfigs: FilterConfig[];
  filters: FiltersState;
  onClearFilters: () => void;
  onSearchChange: (key: string, value: string) => void;
  onSelectChange: (key: string, value: Entity | null) => void;
}

export const FilterPanel = ({
  apiConfig,
  debouncedFilters,
  disabled = false,
  errors = {},
  filterConfigs,
  filters,
  onClearFilters,
  onSearchChange,
  onSelectChange,
}: FilterPanelProperties) => {
  const hasActiveFilters = useMemo(
    () =>
      Object.values(filters).some(filter => filter.selected || filter.search),
    [filters]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <h2 className="text-lg font-semibold">Filters</h2>

      {/* Clear All button below title */}
      {hasActiveFilters && (
        <Button
          className="w-fit text-sm"
          disabled={disabled}
          onClick={onClearFilters}
          size="sm"
          variant="ghost"
        >
          Clear All
        </Button>
      )}

      {/* Filter selects */}
      <div
        className={`
          grid grid-cols-1 gap-4
          md:grid-cols-2
          lg:grid-cols-3
        `}
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
              disabled={disabled}
              error={errors[config.key]}
              fetchNextPage={filterQuery.fetchNextPage}
              hasNextPage={filterQuery.hasNextPage ?? false}
              isError={filterQuery.isError}
              isFetching={filterQuery.isFetching}
              isFetchingNextPage={filterQuery.isFetchingNextPage}
              key={config.key}
              onSearchChange={onSearchChange}
              onSelectChange={onSelectChange}
              search={filters[config.key]?.search || ""}
              selectedValue={filters[config.key]?.selected || null}
            />
          );
        })}
      </div>
    </div>
  );
};
