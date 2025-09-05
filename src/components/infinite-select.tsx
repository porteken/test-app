import { InfiniteData } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

export type Entity = {
  id: string;
  name: string;
};

export type FilterConfig = {
  apiField: string;
  key: string;
  label: string;
  placeholder: string;
};

export type InfiniteQueryPage<TItem extends Entity = Entity> = {
  items: TItem[];
  nextPage?: number;
};

export type InfiniteSearchableSelectProperties<TData extends Entity> = {
  config: FilterConfig;
  data: InfiniteData<InfiniteQueryPage<TData>> | undefined;
  disabled?: boolean;
  error?: string;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  itemToId: (_item: TData) => string;
  itemToName: (_iitem: TData) => string;
  keepSearchOnSelect?: boolean;
  onValueChange: (_ivalue: null | TData) => void;
  search: string;
  selectedValue: null | TData;
  setSearch: (_isearch: string) => void;
};

export function InfiniteSearchableSelect<TData extends Entity>({
  config,
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
  keepSearchOnSelect = false,
  onValueChange,
  search,
  selectedValue,
  setSearch,
}: Readonly<InfiniteSearchableSelectProperties<TData>>) {
  const [open, setOpen] = useState(false);
  const triggerReference = useRef<HTMLButtonElement>(null);
  const commandListReference = useRef<HTMLDivElement>(null);

  const listboxId = useId();
  const comboboxId = useMemo(() => `combobox-${config.key}`, [config.key]);
  const describedById = useMemo(
    () => `${comboboxId}-description`,
    [comboboxId]
  );

  const allItems = useMemo<TData[]>(
    () => data?.pages?.flatMap(p => p.items) ?? [],
    [data]
  );

  const { inView, ref: intersectionReference } = useInView({
    rootMargin: "100px",
    threshold: 0,
  });

  const canLoadMore =
    hasNextPage && !isFetching && !isFetchingNextPage && !disabled;

  const debouncedFetchNext = useDebouncedCallback(() => {
    if (canLoadMore) fetchNextPage();
  }, 250);

  useEffect(() => {
    if (inView) debouncedFetchNext();
  }, [inView, debouncedFetchNext]);

  const handleSelectItem = useCallback(
    (item: TData) => {
      if (disabled) return;
      onValueChange(item);
      if (!keepSearchOnSelect) {
        setSearch(itemToName(item) || "");
      }
      setOpen(false);
      // Return focus to trigger for accessibility
      requestAnimationFrame(() => triggerReference.current?.focus());
    },
    [disabled, keepSearchOnSelect, itemToName, onValueChange, setSearch]
  );

  const handleClear = useCallback(
    (event: React.KeyboardEvent | React.MouseEvent) => {
      if (disabled) return;
      if ("key" in event && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onValueChange(null);
      setSearch("");
      // Keep popover closed after clear to avoid confusion
      setOpen(false);
      requestAnimationFrame(() => triggerReference.current?.focus());
    },
    [disabled, onValueChange, setSearch]
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => triggerReference.current?.focus());
    }
  }, []);

  // Reset scroll when search changes and list is visible
  useEffect(() => {
    if (open && commandListReference.current) {
      commandListReference.current.scrollTop = 0;
    }
  }, [search, open]);

  const hasValidItems = allItems.length > 0;
  const showError = isError || !!error;
  const showEmptySearch =
    !showError && !isFetching && search.length > 0 && !hasValidItems;
  const showInitialEmpty =
    !showError && !isFetching && search.length === 0 && !hasValidItems;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={comboboxId}>
        {config.label}
      </label>

      <Popover onOpenChange={setOpen} open={open}>
        <div className="relative">
          <PopoverTrigger asChild>
            <Button
              aria-controls={open ? listboxId : undefined}
              aria-describedby={showError && error ? describedById : undefined}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-invalid={showError || undefined}
              className={`
                w-full justify-between
                data-[error=true]:border-red-500
                data-[error=true]:focus:border-red-500
              `}
              data-error={showError ? "true" : undefined}
              disabled={disabled}
              id={comboboxId}
              onKeyDown={handleKeyDown}
              ref={triggerReference}
              variant="outline"
            >
              <span className="truncate">
                {selectedValue ? itemToName(selectedValue) : config.placeholder}
              </span>

              <span className="ml-2 flex items-center gap-1">
                {selectedValue && !disabled && (
                  <button
                    aria-label={`Clear ${config.label}`}
                    className={`
                      flex h-5 w-5 items-center justify-center rounded
                      hover:bg-gray-100
                    `}
                    onClick={handleClear}
                    tabIndex={-1}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {isFetching && !isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                )}
              </span>
            </Button>
          </PopoverTrigger>

          {/* Optional description for error */}
          {showError && error && (
            <span className="sr-only" id={describedById}>
              {error}
            </span>
          )}
        </div>

        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label={`Search ${config.label}`}
              autoFocus
              onValueChange={setSearch}
              placeholder={config.placeholder}
              value={search}
            />

            <CommandList
              className="max-h-52"
              id={listboxId}
              ref={commandListReference}
            >
              {showError && (
                <CommandEmpty className="text-red-500">
                  {error || "Error fetching data"}
                </CommandEmpty>
              )}

              {showInitialEmpty && (
                <CommandEmpty>No options available</CommandEmpty>
              )}

              {showEmptySearch && <CommandEmpty>No results found</CommandEmpty>}

              {hasValidItems && (
                <CommandGroup>
                  {allItems.map(item => {
                    const id = itemToId(item) || "";
                    const label = itemToName(item) || "";
                    return (
                      <CommandItem
                        className="cursor-pointer"
                        key={id}
                        onSelect={() => handleSelectItem(item)}
                        value={id}
                      >
                        <span className="truncate">{label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {hasNextPage && (
                <div
                  className="h-4"
                  data-testid="infinite-scroll-trigger"
                  ref={intersectionReference}
                />
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
