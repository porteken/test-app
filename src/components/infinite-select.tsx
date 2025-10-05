import { InfiniteData } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
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

export type FilterConfig = {
  apiField: string;
  key: string;
  label: string;
  placeholder: string;
};
export type InfiniteQueryPageKV = { items: KVItem[]; nextPage?: number };
export type InfiniteQueryResult<TPage> = {
  data: InfiniteData<TPage> | undefined;
  error?: Error | null;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
};

export type InfiniteSearchableSelectProperties = {
  config: FilterConfig;
  disabled?: boolean;

  // Required virtualization config
  itemSize?: number;

  // UX toggles
  keepSearchOnSelect?: boolean;

  // Optional outward notification when selection changes
  onChange?: (_value: KVItem | null) => void;
  onSearchChange?: (_s: string) => void;

  // Entire React Query infinite result passed in
  query: InfiniteQueryResult<InfiniteQueryPageKV>;

  // Optional external search control (defaults to internal)
  search?: string;
  showClearWhenSearchNotEmpty?: boolean;
};

export type KVItem = { key: number | string; value: string };

export function InfiniteSearchableSelect({
  config,
  disabled = false,
  itemSize = 36,
  keepSearchOnSelect = false,
  onChange,
  onSearchChange,
  query,
  search: controlledSearch,
  showClearWhenSearchNotEmpty = true,
}: Readonly<InfiniteSearchableSelectProperties>) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
  } = query;

  // Internal selection and open state
  const [selectedValue, setSelectedValue] = useState<KVItem | null>(null);
  const [open, setOpen] = useState(false);

  // Search can be controlled or internal
  const [internalSearch, setInternalSearch] = useState("");
  const search = controlledSearch ?? internalSearch;
  const setSearch = useCallback(
    (s: string) => {
      if (onSearchChange) {
        onSearchChange(s);
      } else {
        setInternalSearch(s);
      }
    },
    [onSearchChange]
  );

  const triggerReference = useRef<HTMLButtonElement>(null);
  const commandListReference = useRef<HTMLDivElement>(null);

  const listboxId = useId();
  const comboboxId = useMemo(() => `combobox-${config.key}`, [config.key]);
  const describedById = useMemo(
    () => `${comboboxId}-description`,
    [comboboxId]
  );

  const allItems = useMemo<KVItem[]>(
    () => data?.pages?.flatMap(p => p.items) ?? [],
    [data]
  );

  // Virtualizer — required and always called
  const virtualizer = useVirtualizer({
    count: allItems.length,
    estimateSize: () => itemSize,
    getScrollElement: () => commandListReference.current,
    overscan: 10,
  });

  const { inView, ref: intersectionReference } = useInView({
    rootMargin: "100px",
    threshold: 0,
  });

  const canLoadMore =
    !!hasNextPage && !isFetching && !isFetchingNextPage && !disabled;

  const debouncedFetchNext = useDebouncedCallback(() => {
    if (canLoadMore) fetchNextPage();
  }, 250);

  useEffect(() => {
    if (inView) debouncedFetchNext();
  }, [inView, debouncedFetchNext]);

  // Keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex(previous =>
      Math.min(previous, Math.max(0, allItems.length - 1))
    );
  }, [open, allItems.length, search]);

  const scrollHighlightedIntoView = useCallback(
    (index: number) => {
      if (index < 0) return;
      virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [virtualizer]
  );

  const moveHighlight = useCallback(
    (delta: number) => {
      if (allItems.length === 0) return;
      setHighlightedIndex(previous => {
        let next;
        if (previous < 0) next = delta > 0 ? 0 : allItems.length - 1;
        else next = (previous + delta + allItems.length) % allItems.length;
        requestAnimationFrame(() => scrollHighlightedIntoView(next));
        return next;
      });
    },
    [allItems.length, scrollHighlightedIntoView]
  );

  const setHighlightAbsolute = useCallback(
    (index: number) => {
      if (allItems.length === 0) return;
      const next = Math.max(0, Math.min(allItems.length - 1, index));
      setHighlightedIndex(next);
      requestAnimationFrame(() => scrollHighlightedIntoView(next));
    },
    [allItems.length, scrollHighlightedIntoView]
  );

  const handleSelectItem = useCallback(
    (item: KVItem) => {
      if (disabled) return;
      setSelectedValue(item);
      onChange?.(item);
      if (!keepSearchOnSelect) {
        setSearch(item.value || "");
      }
      setOpen(false);
      requestAnimationFrame(() => triggerReference.current?.focus());
    },
    [disabled, keepSearchOnSelect, onChange, setSearch]
  );

  const handleClear = useCallback(
    (event: React.KeyboardEvent | React.MouseEvent) => {
      if (disabled) return;
      if ("key" in event && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setSelectedValue(null);
      onChange?.(null);
      setSearch("");
      setOpen(false);
      requestAnimationFrame(() => triggerReference.current?.focus());
    },
    [disabled, onChange, setSearch]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          moveHighlight(1);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          moveHighlight(-1);
          break;
        }
        case "End": {
          event.preventDefault();
          setHighlightAbsolute(allItems.length - 1);
          break;
        }
        case "Enter": {
          if (highlightedIndex >= 0 && highlightedIndex < allItems.length) {
            event.preventDefault();
            const item = allItems[highlightedIndex];
            if (item) handleSelectItem(item);
          }
          break;
        }
        case "Escape": {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          requestAnimationFrame(() => triggerReference.current?.focus());
          break;
        }
        case "Home": {
          event.preventDefault();
          setHighlightAbsolute(0);
          break;
        }
        case "PageDown": {
          event.preventDefault();
          setHighlightAbsolute(
            Math.min(Math.max(highlightedIndex, 0) + 10, allItems.length - 1)
          );
          break;
        }
        case "PageUp": {
          event.preventDefault();
          setHighlightAbsolute(Math.max(Math.max(highlightedIndex, 0) - 10, 0));
          break;
        }
      }
    },
    [
      allItems,
      highlightedIndex,
      moveHighlight,
      open,
      setHighlightAbsolute,
      handleSelectItem,
    ]
  );

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
  const isInitialLoading = isFetching && !hasValidItems;

  const shouldShowClear =
    !!selectedValue &&
    !disabled &&
    (showClearWhenSearchNotEmpty || search.length === 0);

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
              ref={triggerReference}
              variant="outline"
            >
              <span className="truncate">
                {selectedValue ? selectedValue.value : config.placeholder}
              </span>

              <span className="ml-2 flex items-center gap-1">
                {shouldShowClear && (
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

          {showError && error && (
            <span className="sr-only" id={describedById}>
              {error.message}
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
              onKeyDown={handleInputKeyDown}
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
                  {error?.message || "Error fetching data"}
                </CommandEmpty>
              )}

              {isInitialLoading && (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {showInitialEmpty && (
                <CommandEmpty>No options available</CommandEmpty>
              )}

              {showEmptySearch && <CommandEmpty>No results found</CommandEmpty>}

              {hasValidItems && (
                <CommandGroup>
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualizer.getVirtualItems().map(vi => {
                      const item = allItems[vi.index];
                      const id = String(item.key);
                      const label = item.value;
                      const isHighlighted = vi.index === highlightedIndex;
                      return (
                        <div
                          data-index={vi.index}
                          key={id}
                          style={{
                            left: 0,
                            position: "absolute",
                            top: 0,
                            transform: `translateY(${vi.start}px)`,
                            width: "100%",
                          }}
                        >
                          <CommandItem
                            className={`
                              cursor-pointer
                              ${isHighlighted ? "bg-accent" : ""}
                            `}
                            data-item="true"
                            onMouseEnter={() => setHighlightedIndex(vi.index)}
                            onSelect={() => handleSelectItem(item)}
                            value={id}
                          >
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        </div>
                      );
                    })}
                  </div>
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

      {showError && error && (
        <p className="text-sm text-red-500">{error.message}</p>
      )}
    </div>
  );
}
